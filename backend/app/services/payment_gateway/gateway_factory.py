import datetime
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import (
    OrganizationSettings, Invoice, Customer, Payment, PaymentAllocation,
    AuditLog, Notification
)
from app.services.payment_gateway.base import PaymentGatewayProvider
from app.services.payment_gateway.razorpay_provider import RazorpayProvider
from app.services.payment_gateway.stripe_provider import StripeProvider

def get_gateway_provider(provider_name: str, settings: OrganizationSettings) -> PaymentGatewayProvider:
    """
    Factory that instantiates the requested payment provider configured with credentials.
    """
    prov = (provider_name or "").lower().strip()
    mode = getattr(settings, "gateway_mode", "sandbox")

    if prov == "razorpay":
        return RazorpayProvider(
            key_id=getattr(settings, "razorpay_key_id", "rzp_test_brightloop123"),
            key_secret=getattr(settings, "razorpay_key_secret", "rzp_secret_sandbox999"),
            webhook_secret=getattr(settings, "razorpay_webhook_secret", "whsec_rzp_sandbox"),
            mode=mode
        )
    elif prov == "stripe":
        return StripeProvider(
            publishable_key=getattr(settings, "stripe_publishable_key", "pk_test_brightloop_stripe"),
            secret_key=getattr(settings, "stripe_secret_key", "sk_test_brightloop_stripe_sec"),
            webhook_secret=getattr(settings, "stripe_webhook_secret", "whsec_stripe_sandbox"),
            mode=mode
        )
    else:
        raise ValueError(f"Unsupported gateway provider: {provider_name}. Valid options: razorpay, stripe")

def reconcile_gateway_transaction(
    db: Session,
    event_data: Dict[str, Any],
    raw_payload_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Server-authoritative reconciliation of gateway payment events.
    Applies strict idempotency: duplicate webhooks do not double-bill or double-credit.
    """
    provider = event_data.get("provider", "unknown")
    order_id = event_data.get("order_id")
    payment_id = event_data.get("payment_id")
    amount = Decimal(str(event_data.get("amount", 0)))
    success = event_data.get("success", False)
    invoice_id = event_data.get("invoice_id")
    event_type = event_data.get("event_type", "unknown")

    # 1. Check idempotency: Have we already recorded this payment_id?
    existing_payment = db.query(Payment).filter(
        Payment.gateway_payment_id == payment_id,
        Payment.status == "confirmed"
    ).first()
    if existing_payment:
        return {
            "reconciled": True,
            "duplicate": True,
            "payment_id": existing_payment.id,
            "payment_number": existing_payment.payment_number,
            "invoice_status": existing_payment.invoice.status if existing_payment.invoice else "unknown",
            "message": f"Payment {payment_id} was already processed and reconciled under {existing_payment.payment_number}."
        }

    # 2. Retrieve invoice
    invoice = None
    if invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    
    if not invoice and order_id:
        # Try looking up payment by gateway_order_id if previously initiated
        prev = db.query(Payment).filter(Payment.gateway_order_id == order_id).first()
        if prev and prev.invoice:
            invoice = prev.invoice

    if not invoice:
        return {
            "reconciled": False,
            "duplicate": False,
            "invoice_status": "not_found",
            "message": f"Invoice {invoice_id} not found for payment {payment_id}."
        }

    customer = invoice.customer
    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    if not success:
        # Record failed payment attempt for audit transparency
        pay_num = f"{settings.payment_prefix}{settings.next_payment_number:05d}"
        settings.next_payment_number += 1
        failed_payment = Payment(
            payment_number=pay_num,
            invoice_id=invoice.id,
            customer_id=customer.id,
            payment_method=event_data.get("method", "card"),
            amount=amount,
            payment_date=datetime.datetime.now(datetime.timezone.utc),
            transaction_reference=event_data.get("transaction_reference"),
            notes=f"Gateway Payment Failed: {event_data.get('failure_reason', 'Declined')}",
            status="failed",
            gateway_provider=provider,
            gateway_order_id=order_id,
            gateway_payment_id=payment_id,
            raw_webhook_data=raw_payload_str
        )
        db.add(failed_payment)
        db.commit()

        audit = AuditLog(
            entity_type="payment",
            entity_id=failed_payment.id,
            action="gateway_payment_failed",
            details=f"Gateway payment failed via {provider.upper()} for invoice {invoice.invoice_number}. Reason: {event_data.get('failure_reason')}",
            user_id=customer.user_id
        )
        db.add(audit)
        db.commit()

        return {
            "reconciled": False,
            "duplicate": False,
            "payment_id": failed_payment.id,
            "payment_number": failed_payment.payment_number,
            "invoice_status": invoice.status,
            "message": f"Payment failure recorded for {invoice.invoice_number}."
        }

    # 3. Successful transaction: generate confirmed payment and reconcile
    pay_num = f"{settings.payment_prefix}{settings.next_payment_number:05d}"
    settings.next_payment_number += 1

    new_payment = Payment(
        payment_number=pay_num,
        invoice_id=invoice.id,
        customer_id=customer.id,
        payment_method=event_data.get("method", "card"),
        amount=amount,
        payment_date=datetime.datetime.now(datetime.timezone.utc),
        transaction_reference=event_data.get("transaction_reference"),
        notes=f"Online payment confirmed via {provider.title()} Sandbox ({event_type})",
        status="confirmed",
        gateway_provider=provider,
        gateway_order_id=order_id,
        gateway_payment_id=payment_id,
        raw_webhook_data=raw_payload_str
    )
    db.add(new_payment)
    db.flush()

    # Allocate against invoice balance
    alloc_amount = min(amount, invoice.balance_due)
    if alloc_amount > Decimal("0.00"):
        alloc = PaymentAllocation(
            payment_id=new_payment.id,
            invoice_id=invoice.id,
            allocated_amount=alloc_amount
        )
        db.add(alloc)

        invoice.amount_paid += alloc_amount
        invoice.balance_due -= alloc_amount
        if invoice.balance_due <= Decimal("0.00"):
            invoice.balance_due = Decimal("0.00")
            invoice.status = "paid"
        else:
            invoice.status = "partially_paid"

    # Reduce customer overall outstanding balance
    customer.outstanding_balance -= amount
    if customer.outstanding_balance < Decimal("0.00"):
        customer.outstanding_balance = Decimal("0.00")

    db.commit()
    db.refresh(new_payment)

    # Audit log
    audit = AuditLog(
        entity_type="payment",
        entity_id=new_payment.id,
        action="gateway_payment_reconciled",
        details=f"Reconciled online payment {pay_num} for ₹{amount:.2f} via {provider.upper()} for invoice {invoice.invoice_number}",
        user_id=customer.user_id
    )
    db.add(audit)

    # Notification
    if customer.user_id:
        notif = Notification(
            user_id=customer.user_id,
            title="Payment Received",
            message=f"We have received payment of ₹{amount:.2f} for invoice {invoice.invoice_number} via {provider.title()}.",
            type="payment",
            link="/customer-portal"
        )
        db.add(notif)

    db.commit()

    return {
        "reconciled": True,
        "duplicate": False,
        "payment_id": new_payment.id,
        "payment_number": new_payment.payment_number,
        "invoice_status": invoice.status,
        "message": f"Payment {new_payment.payment_number} successfully verified and reconciled against {invoice.invoice_number}."
    }
