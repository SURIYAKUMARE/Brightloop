import datetime
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import (
    Subscription, SubscriptionItem, Invoice, InvoiceItem, Customer,
    BillingJob, SubscriptionTimeline, Notification, OrganizationSettings, User
)

def calculate_next_period(current_end: datetime.datetime, interval: str) -> tuple[datetime.datetime, datetime.datetime]:
    """
    Calculates next period start and end based on the billing interval.
    Intervals: daily, weekly, monthly, yearly.
    """
    new_start = current_end
    if interval == "daily":
        new_end = new_start + datetime.timedelta(days=1)
    elif interval == "weekly":
        new_end = new_start + datetime.timedelta(weeks=1)
    elif interval == "yearly":
        try:
            new_end = new_start.replace(year=new_start.year + 1)
        except ValueError:
            # Handle leap year
            new_end = new_start + datetime.timedelta(days=365)
    else:  # monthly default
        # Add ~30 days or advance month safely
        month = new_start.month + 1
        year = new_start.year
        if month > 12:
            month = 1
            year += 1
        try:
            new_end = new_start.replace(year=year, month=month)
        except ValueError:
            # Day overflow (e.g., Jan 31 -> Feb 28)
            new_end = (new_start.replace(day=1, year=year, month=month) + datetime.timedelta(days=32)).replace(day=1) - datetime.timedelta(days=1)
    return new_start, new_end

def run_billing_cycle(db: Session, force_subscription_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Core automated recurring billing engine with strict idempotency and duplicate prevention.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Fetch subscriptions due for billing
    query = db.query(Subscription).filter(Subscription.status == "active")
    if force_subscription_id:
        query = query.filter(Subscription.id == force_subscription_id)
    else:
        query = query.filter(Subscription.next_billing_date <= now)

    subscriptions_due = query.all()

    processed_count = 0
    invoices_generated = 0
    total_billed = Decimal("0.00")
    errors_count = 0
    logs = []

    logs.append(f"[{now.isoformat()}] Billing cycle initiated. Found {len(subscriptions_due)} subscriptions eligible.")

    for sub in subscriptions_due:
        try:
            customer = db.query(Customer).filter(Customer.id == sub.customer_id).first()
            if not customer:
                logs.append(f"Subscription {sub.subscription_number}: Customer ID {sub.customer_id} not found. Skipping.")
                errors_count += 1
                continue

            # Check if subscription has expired
            if sub.expiry_date and sub.expiry_date <= now:
                sub.status = "expired"
                timeline = SubscriptionTimeline(
                    subscription_id=sub.id,
                    event_type="status_change",
                    old_status="active",
                    new_status="expired",
                    description=f"Subscription expired on {sub.expiry_date.strftime('%Y-%m-%d')}."
                )
                db.add(timeline)
                logs.append(f"Subscription {sub.subscription_number} expired. Status updated to expired.")
                continue

            period_start = sub.current_period_end
            period_start, period_end = calculate_next_period(sub.current_period_end, sub.billing_interval)

            # Idempotency safeguard: Check for existing invoice for this period
            idempotency_key = f"sub-{sub.id}-{period_start.strftime('%Y%m%d')}-{period_end.strftime('%Y%m%d')}"
            existing_invoice = db.query(Invoice).filter(
                or_(
                    Invoice.idempotency_key == idempotency_key,
                    (Invoice.subscription_id == sub.id) & (Invoice.period_start == period_start)
                )
            ).first()

            if existing_invoice:
                logs.append(f"Subscription {sub.subscription_number}: Invoice already exists ({existing_invoice.invoice_number}) for period {period_start.strftime('%Y-%m-%d')} to {period_end.strftime('%Y-%m-%d')}. Idempotency check prevented duplicate.")
                # Advance next billing date if not advanced
                if sub.next_billing_date <= now:
                    sub.next_billing_date = period_end
                continue

            # Generate Invoice Number
            invoice_num = f"{settings.invoice_prefix}{settings.next_invoice_number:05d}"
            settings.next_invoice_number += 1

            due_date = now + datetime.timedelta(days=settings.grace_period_days if settings.grace_period_days > 0 else 7)

            # Calculate line items, taxes, discounts with exact Decimal arithmetic
            subtotal = Decimal("0.00")
            tax_amount = Decimal("0.00")
            discount_amount = Decimal("0.00")

            invoice_items = []
            for item in sub.items:
                line_subtotal = item.unit_price * Decimal(item.quantity)
                line_discount = item.discount_amount
                line_taxable = line_subtotal - line_discount
                if line_taxable < Decimal("0.00"):
                    line_taxable = Decimal("0.00")
                line_tax = (line_taxable * item.tax_rate) / Decimal("100.00")
                line_total = line_taxable + line_tax

                subtotal += line_subtotal
                discount_amount += line_discount
                tax_amount += line_tax

                inv_item = InvoiceItem(
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    tax_rate=item.tax_rate,
                    discount_amount=line_discount,
                    total_price=line_total
                )
                invoice_items.append(inv_item)

            total_amount = subtotal - discount_amount + tax_amount
            if total_amount < Decimal("0.00"):
                total_amount = Decimal("0.00")

            new_invoice = Invoice(
                invoice_number=invoice_num,
                customer_id=customer.id,
                subscription_id=sub.id,
                status="confirmed",
                invoice_date=now,
                due_date=due_date,
                period_start=period_start,
                period_end=period_end,
                subtotal=subtotal,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                total_amount=total_amount,
                amount_paid=Decimal("0.00"),
                balance_due=total_amount,
                notes=f"Automated recurring billing for subscription {sub.subscription_number} ({sub.billing_interval.capitalize()}).",
                idempotency_key=idempotency_key,
                items=invoice_items
            )
            db.add(new_invoice)

            # Update customer balance
            customer.outstanding_balance += total_amount

            # Advance subscription periods
            sub.current_period_start = period_start
            sub.current_period_end = period_end
            sub.next_billing_date = period_end
            sub.updated_at = now

            # Timeline event
            timeline = SubscriptionTimeline(
                subscription_id=sub.id,
                event_type="invoice_generated",
                old_status=sub.status,
                new_status=sub.status,
                description=f"Generated recurring invoice {invoice_num} for ₹{total_amount:.2f}."
            )
            db.add(timeline)

            # In-app notification for customer if linked
            if customer.user_id:
                notif = Notification(
                    user_id=customer.user_id,
                    title=f"New Invoice {invoice_num}",
                    message=f"Your subscription {sub.subscription_number} has been billed for ₹{total_amount:.2f}. Due date: {due_date.strftime('%Y-%m-%d')}.",
                    type="payment",
                    link=f"/invoices/{invoice_num}"
                )
                db.add(notif)

            processed_count += 1
            invoices_generated += 1
            total_billed += total_amount
            logs.append(f"Successfully processed {sub.subscription_number}: Generated {invoice_num} for ₹{total_amount:.2f}.")

        except Exception as e:
            errors_count += 1
            logs.append(f"Error processing subscription {sub.subscription_number}: {str(e)}")

    # Update overdue invoices
    overdue_invoices = db.query(Invoice).filter(
        Invoice.status.in_(["confirmed", "partially_paid"]),
        Invoice.due_date < now
    ).all()
    for inv in overdue_invoices:
        inv.status = "overdue"
        logs.append(f"Invoice {inv.invoice_number} marked overdue. Due date was {inv.due_date.strftime('%Y-%m-%d')}.")

    job = BillingJob(
        run_at=now,
        subscriptions_processed=processed_count,
        invoices_generated=invoices_generated,
        total_billed=total_billed,
        errors_count=errors_count,
        execution_log="\n".join(logs),
        status="completed" if errors_count == 0 else "completed_with_errors"
    )
    db.add(job)
    db.commit()

    return {
        "subscriptions_processed": processed_count,
        "invoices_generated": invoices_generated,
        "total_billed": total_billed,
        "errors_count": errors_count,
        "execution_log": "\n".join(logs)
    }
