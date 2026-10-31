import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import (
    Quotation, QuotationItem, QuotationTemplate, Customer, Subscription,
    SubscriptionItem, SubscriptionTimeline, OrganizationSettings, User, AuditLog
)
from app.schemas import QuotationCreate, QuotationOut, QuotationItemOut, SubscriptionOut
from app.services.auth_service import get_current_user, require_staff_or_admin

router = APIRouter(prefix="/quotations", tags=["Quotations"])

@router.get("/", response_model=List[QuotationOut])
def get_quotations(
    status_filter: Optional[str] = None,
    customer_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Quotation)
    if current_user.role == "customer":
        if not current_user.customer_profile:
            return []
        query = query.filter(Quotation.customer_id == current_user.customer_profile.id)
    elif customer_id:
        query = query.filter(Quotation.customer_id == customer_id)

    if status_filter:
        query = query.filter(Quotation.status == status_filter)

    quotes = query.order_by(Quotation.created_at.desc()).all()
    out = []
    for q in quotes:
        item = QuotationOut(
            id=q.id,
            quotation_number=q.quotation_number,
            customer_id=q.customer_id,
            customer_name=q.customer.name if q.customer else None,
            customer_email=q.customer.email if q.customer else None,
            status=q.status,
            valid_until=q.valid_until,
            subtotal=q.subtotal,
            tax_amount=q.tax_amount,
            discount_amount=q.discount_amount,
            total_amount=q.total_amount,
            notes=q.notes,
            terms=q.terms,
            items=[
                QuotationItemOut(
                    id=qi.id,
                    product_id=qi.product_id,
                    variant_id=qi.variant_id,
                    plan_id=qi.plan_id,
                    description=qi.description,
                    quantity=qi.quantity,
                    unit_price=qi.unit_price,
                    tax_rate=qi.tax_rate,
                    discount_amount=qi.discount_amount,
                    total_price=qi.total_price
                ) for qi in q.items
            ],
            created_at=q.created_at,
            updated_at=q.updated_at,
            version=q.version
        )
        out.append(item)
    return out

@router.post("/", response_model=QuotationOut)
def create_quotation(
    q_in: QuotationCreate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == q_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    q_number = f"{settings.quotation_prefix}{settings.next_quotation_number:05d}"
    settings.next_quotation_number += 1

    subtotal = Decimal("0.00")
    tax_amount = Decimal("0.00")
    discount_amount = Decimal("0.00")

    items = []
    for item in q_in.items:
        line_sub = item.unit_price * Decimal(item.quantity)
        line_disc = item.discount_amount
        line_taxable = line_sub - line_disc
        if line_taxable < Decimal("0.00"):
            line_taxable = Decimal("0.00")
        line_tax = (line_taxable * item.tax_rate) / Decimal("100.00")
        line_tot = line_taxable + line_tax

        subtotal += line_sub
        discount_amount += line_disc
        tax_amount += line_tax

        qi = QuotationItem(
            product_id=item.product_id,
            variant_id=item.variant_id,
            plan_id=item.plan_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            tax_rate=item.tax_rate,
            discount_amount=item.discount_amount,
            total_price=line_tot
        )
        items.append(qi)

    total_amount = subtotal - discount_amount + tax_amount
    if total_amount < Decimal("0.00"):
        total_amount = Decimal("0.00")

    new_q = Quotation(
        quotation_number=q_number,
        customer_id=customer.id,
        template_id=q_in.template_id,
        status="sent",
        valid_until=q_in.valid_until,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        notes=q_in.notes,
        terms=q_in.terms,
        created_by_id=current_user.id,
        items=items,
        version=1
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)

    audit = AuditLog(
        entity_type="quotation",
        entity_id=new_q.id,
        action="create",
        details=f"Quotation {q_number} created for {customer.name} (Total: ₹{total_amount:.2f})",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return QuotationOut(
        id=new_q.id,
        quotation_number=new_q.quotation_number,
        customer_id=new_q.customer_id,
        customer_name=customer.name,
        customer_email=customer.email,
        status=new_q.status,
        valid_until=new_q.valid_until,
        subtotal=new_q.subtotal,
        tax_amount=new_q.tax_amount,
        discount_amount=new_q.discount_amount,
        total_amount=new_q.total_amount,
        notes=new_q.notes,
        terms=new_q.terms,
        items=[
            QuotationItemOut(
                id=qi.id,
                product_id=qi.product_id,
                variant_id=qi.variant_id,
                plan_id=qi.plan_id,
                description=qi.description,
                quantity=qi.quantity,
                unit_price=qi.unit_price,
                tax_rate=qi.tax_rate,
                discount_amount=qi.discount_amount,
                total_price=qi.total_price
            ) for qi in new_q.items
        ],
        created_at=new_q.created_at,
        updated_at=new_q.updated_at,
        version=new_q.version
    )

@router.post("/{quotation_id}/convert-to-subscription")
def convert_to_subscription(
    quotation_id: int,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    q = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    if q.status == "converted":
        raise HTTPException(status_code=400, detail="Quotation has already been converted into a subscription.")

    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    sub_number = f"{settings.subscription_prefix}{settings.next_subscription_number:05d}"
    settings.next_subscription_number += 1

    now = datetime.datetime.now(datetime.timezone.utc)
    # 30 days initial period
    period_end = now + datetime.timedelta(days=30)

    # Derive plan_id from the first quotation item if available
    plan_id = q.items[0].plan_id if q.items and q.items[0].plan_id else None

    sub_items = []
    for qi in q.items:
        si = SubscriptionItem(
            product_id=qi.product_id,
            variant_id=qi.variant_id,
            description=qi.description,
            quantity=qi.quantity,
            unit_price=qi.unit_price,
            tax_rate=qi.tax_rate,
            discount_amount=qi.discount_amount,
            total_price=qi.total_price
        )
        sub_items.append(si)

    new_sub = Subscription(
        subscription_number=sub_number,
        customer_id=q.customer_id,
        plan_id=plan_id,
        quotation_id=q.id,
        status="active",
        start_date=now,
        current_period_start=now,
        current_period_end=period_end,
        next_billing_date=period_end,
        billing_interval="monthly",
        payment_terms="immediate",
        auto_renew=True,
        subtotal=q.subtotal,
        tax_amount=q.tax_amount,
        discount_amount=q.discount_amount,
        total_amount=q.total_amount,
        currency="INR",
        notes=f"Converted from quotation {q.quotation_number}",
        items=sub_items,
        version=1
    )
    db.add(new_sub)

    q.status = "converted"
    db.flush()

    timeline = SubscriptionTimeline(
        subscription_id=new_sub.id,
        event_type="conversion",
        old_status="draft",
        new_status="active",
        description=f"Subscription activated via conversion from Quotation {q.quotation_number}.",
        performed_by_id=current_user.id
    )
    db.add(timeline)
    db.commit()
    db.refresh(new_sub)

    audit = AuditLog(
        entity_type="quotation",
        entity_id=q.id,
        action="convert",
        details=f"Quotation {q.quotation_number} converted to subscription {new_sub.subscription_number}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Quotation successfully converted to subscription {new_sub.subscription_number}",
        "subscription_id": new_sub.id,
        "subscription_number": new_sub.subscription_number
    }
