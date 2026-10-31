import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import (
    Subscription, SubscriptionItem, SubscriptionTimeline, SubscriptionPlan,
    Customer, OrganizationSettings, User, AuditLog, Notification
)
from app.schemas import (
    SubscriptionCreate, SubscriptionUpdate, SubscriptionOut, SubscriptionAction,
    SubscriptionItemOut, SubscriptionTimelineOut
)
from app.services.auth_service import get_current_user, require_staff_or_admin

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

VALID_TRANSITIONS = {
    "draft": ["confirmed", "active", "cancelled"],
    "quotation": ["confirmed", "active", "cancelled"],
    "confirmed": ["active", "cancelled"],
    "active": ["paused", "pending_renewal", "expired", "cancelled", "closed"],
    "paused": ["active", "cancelled", "closed"],
    "pending_renewal": ["active", "expired", "cancelled", "closed"],
    "expired": ["active", "closed"],
    "cancelled": [],
    "closed": []
}

@router.get("/", response_model=List[SubscriptionOut])
def get_subscriptions(
    status_filter: Optional[str] = None,
    customer_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Subscription)
    if current_user.role == "customer":
        if not current_user.customer_profile:
            return []
        query = query.filter(Subscription.customer_id == current_user.customer_profile.id)
    elif customer_id:
        query = query.filter(Subscription.customer_id == customer_id)

    if status_filter:
        query = query.filter(Subscription.status == status_filter)

    if search:
        s = f"%{search}%"
        query = query.filter(Subscription.subscription_number.ilike(s))

    subs = query.order_by(Subscription.created_at.desc()).all()
    out = []
    for sub in subs:
        item = SubscriptionOut(
            id=sub.id,
            subscription_number=sub.subscription_number,
            customer_id=sub.customer_id,
            customer_name=sub.customer.name if sub.customer else None,
            customer_email=sub.customer.email if sub.customer else None,
            plan_id=sub.plan_id,
            plan_name=sub.plan.name if sub.plan else None,
            status=sub.status,
            start_date=sub.start_date,
            expiry_date=sub.expiry_date,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            next_billing_date=sub.next_billing_date,
            billing_interval=sub.billing_interval,
            payment_terms=sub.payment_terms,
            auto_renew=sub.auto_renew,
            allow_pause=sub.allow_pause,
            allow_early_closure=sub.allow_early_closure,
            subtotal=sub.subtotal,
            tax_amount=sub.tax_amount,
            discount_amount=sub.discount_amount,
            total_amount=sub.total_amount,
            currency=sub.currency,
            notes=sub.notes,
            items=[
                SubscriptionItemOut(
                    id=si.id,
                    product_id=si.product_id,
                    variant_id=si.variant_id,
                    description=si.description,
                    quantity=si.quantity,
                    unit_price=si.unit_price,
                    tax_rate=si.tax_rate,
                    discount_amount=si.discount_amount,
                    total_price=si.total_price
                ) for si in sub.items
            ],
            timeline=[
                SubscriptionTimelineOut(
                    id=st.id,
                    event_type=st.event_type,
                    old_status=st.old_status,
                    new_status=st.new_status,
                    description=st.description,
                    performed_by_name=st.performed_by.full_name if st.performed_by else "System",
                    created_at=st.created_at
                ) for st in sub.timeline
            ],
            created_at=sub.created_at,
            updated_at=sub.updated_at,
            version=sub.version
        )
        out.append(item)
    return out

@router.post("/", response_model=SubscriptionOut)
def create_subscription(
    sub_in: SubscriptionCreate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == sub_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    sub_number = f"{settings.subscription_prefix}{settings.next_subscription_number:05d}"
    settings.next_subscription_number += 1

    now = datetime.datetime.now(datetime.timezone.utc)
    interval = sub_in.billing_interval
    if interval == "daily":
        end_date = sub_in.start_date + datetime.timedelta(days=1)
    elif interval == "weekly":
        end_date = sub_in.start_date + datetime.timedelta(weeks=1)
    elif interval == "yearly":
        end_date = sub_in.start_date + datetime.timedelta(days=365)
    else:
        end_date = sub_in.start_date + datetime.timedelta(days=30)

    subtotal = Decimal("0.00")
    tax_amount = Decimal("0.00")
    discount_amount = Decimal("0.00")

    items = []
    for item in sub_in.items:
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

        si = SubscriptionItem(
            product_id=item.product_id,
            variant_id=item.variant_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            tax_rate=item.tax_rate,
            discount_amount=item.discount_amount,
            total_price=line_tot
        )
        items.append(si)

    total_amount = subtotal - discount_amount + tax_amount
    if total_amount < Decimal("0.00"):
        total_amount = Decimal("0.00")

    new_sub = Subscription(
        subscription_number=sub_number,
        customer_id=customer.id,
        plan_id=sub_in.plan_id,
        quotation_id=sub_in.quotation_id,
        status="active",
        start_date=sub_in.start_date,
        current_period_start=sub_in.start_date,
        current_period_end=end_date,
        next_billing_date=end_date,
        billing_interval=sub_in.billing_interval,
        payment_terms=sub_in.payment_terms,
        auto_renew=sub_in.auto_renew,
        allow_pause=sub_in.allow_pause,
        allow_early_closure=sub_in.allow_early_closure,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        currency="INR",
        notes=sub_in.notes,
        items=items,
        version=1
    )
    db.add(new_sub)
    db.flush()

    timeline = SubscriptionTimeline(
        subscription_id=new_sub.id,
        event_type="creation",
        old_status=None,
        new_status="active",
        description=f"Subscription created directly with status active.",
        performed_by_id=current_user.id
    )
    db.add(timeline)
    db.commit()
    db.refresh(new_sub)

    audit = AuditLog(
        entity_type="subscription",
        entity_id=new_sub.id,
        action="create",
        details=f"Subscription {sub_number} created for {customer.name}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return get_subscription(new_sub.id, current_user, db)

@router.get("/{subscription_id}", response_model=SubscriptionOut)
def get_subscription(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    if current_user.role == "customer" and (not current_user.customer_profile or current_user.customer_profile.id != sub.customer_id):
        raise HTTPException(status_code=403, detail="Access denied. Cannot view other customer subscription.")

    return SubscriptionOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        customer_id=sub.customer_id,
        customer_name=sub.customer.name if sub.customer else None,
        customer_email=sub.customer.email if sub.customer else None,
        plan_id=sub.plan_id,
        plan_name=sub.plan.name if sub.plan else None,
        status=sub.status,
        start_date=sub.start_date,
        expiry_date=sub.expiry_date,
        current_period_start=sub.current_period_start,
        current_period_end=sub.current_period_end,
        next_billing_date=sub.next_billing_date,
        billing_interval=sub.billing_interval,
        payment_terms=sub.payment_terms,
        auto_renew=sub.auto_renew,
        allow_pause=sub.allow_pause,
        allow_early_closure=sub.allow_early_closure,
        subtotal=sub.subtotal,
        tax_amount=sub.tax_amount,
        discount_amount=sub.discount_amount,
        total_amount=sub.total_amount,
        currency=sub.currency,
        notes=sub.notes,
        items=[
            SubscriptionItemOut(
                id=si.id,
                product_id=si.product_id,
                variant_id=si.variant_id,
                description=si.description,
                quantity=si.quantity,
                unit_price=si.unit_price,
                tax_rate=si.tax_rate,
                discount_amount=si.discount_amount,
                total_price=si.total_price
            ) for si in sub.items
        ],
        timeline=[
            SubscriptionTimelineOut(
                id=st.id,
                event_type=st.event_type,
                old_status=st.old_status,
                new_status=st.new_status,
                description=st.description,
                performed_by_name=st.performed_by.full_name if st.performed_by else "System",
                created_at=st.created_at
            ) for st in sub.timeline
        ],
        created_at=sub.created_at,
        updated_at=sub.updated_at,
        version=sub.version
    )

@router.post("/{subscription_id}/action", response_model=SubscriptionOut)
def execute_subscription_action(
    subscription_id: int,
    action_in: SubscriptionAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    # Customer can request cancellation or renewal
    if current_user.role == "customer":
        if not current_user.customer_profile or current_user.customer_profile.id != sub.customer_id:
            raise HTTPException(status_code=403, detail="Access denied.")
        if action_in.action not in ["cancel", "renew"]:
            raise HTTPException(status_code=403, detail="Customers may only request renewal or cancellation.")

    old_status = sub.status
    act = action_in.action

    if act == "pause":
        if not sub.allow_pause:
            raise HTTPException(status_code=400, detail="This plan does not permit pausing.")
        if old_status != "active":
            raise HTTPException(status_code=400, detail="Only active subscriptions can be paused.")
        sub.status = "paused"
        desc = f"Subscription paused. Reason: {action_in.reason or 'User requested pause'}."

    elif act == "resume":
        if old_status != "paused":
            raise HTTPException(status_code=400, detail="Only paused subscriptions can be resumed.")
        sub.status = "active"
        desc = "Subscription resumed to active status."

    elif act == "cancel":
        if not sub.allow_early_closure and current_user.role == "customer":
            raise HTTPException(status_code=400, detail="Early cancellation is disabled for this subscription plan.")
        sub.status = "cancelled"
        desc = f"Subscription cancelled. Reason: {action_in.reason or 'Customer request'}."

    elif act == "close":
        sub.status = "closed"
        desc = f"Subscription closed. Reason: {action_in.reason or 'Administrative closure'}."

    elif act == "renew":
        now = datetime.datetime.now(datetime.timezone.utc)
        sub.status = "active"
        # Advance 1 period
        sub.current_period_start = sub.current_period_end
        if sub.billing_interval == "yearly":
            sub.current_period_end = sub.current_period_start + datetime.timedelta(days=365)
        else:
            sub.current_period_end = sub.current_period_start + datetime.timedelta(days=30)
        sub.next_billing_date = sub.current_period_end
        desc = "Subscription manually renewed for another billing cycle."

    elif act == "upgrade" and action_in.new_plan_id:
        new_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == action_in.new_plan_id).first()
        if not new_plan:
            raise HTTPException(status_code=404, detail="Selected plan not found.")
        old_plan_name = sub.plan.name if sub.plan else "None"
        sub.plan_id = new_plan.id
        sub.billing_interval = new_plan.billing_interval
        sub.subtotal = new_plan.base_price
        sub.total_amount = new_plan.base_price + sub.tax_amount - sub.discount_amount
        desc = f"Subscription plan changed from {old_plan_name} to {new_plan.name}."

    else:
        raise HTTPException(status_code=400, detail=f"Unrecognized or invalid lifecycle transition: {act}")

    sub.version += 1
    sub.updated_at = datetime.datetime.now(datetime.timezone.utc)

    timeline = SubscriptionTimeline(
        subscription_id=sub.id,
        event_type=f"action_{act}",
        old_status=old_status,
        new_status=sub.status,
        description=desc,
        performed_by_id=current_user.id
    )
    db.add(timeline)
    db.commit()
    db.refresh(sub)

    audit = AuditLog(
        entity_type="subscription",
        entity_id=sub.id,
        action=act,
        details=f"Subscription {sub.subscription_number}: {desc}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return get_subscription(sub.id, current_user, db)
