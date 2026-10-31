from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SubscriptionPlan, Product, User, AuditLog
from app.schemas import PlanCreate, PlanUpdate, PlanOut
from app.services.auth_service import get_current_user, require_admin

router = APIRouter(prefix="/plans", tags=["Subscription Plans"])

@router.get("/", response_model=List[PlanOut])
def get_plans(
    status_filter: Optional[str] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SubscriptionPlan)
    if status_filter:
        query = query.filter(SubscriptionPlan.status == status_filter)
    if product_id:
        query = query.filter(SubscriptionPlan.product_id == product_id)
    plans = query.order_by(SubscriptionPlan.created_at.desc()).all()
    
    out = []
    for p in plans:
        item = PlanOut.model_validate(p)
        item.product_name = p.product.name if p.product else None
        out.append(item)
    return out

@router.post("/", response_model=PlanOut)
def create_plan(
    plan_in: PlanCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    prod = db.query(Product).filter(Product.id == plan_in.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Associated product not found.")

    new_plan = SubscriptionPlan(
        name=plan_in.name,
        product_id=plan_in.product_id,
        billing_interval=plan_in.billing_interval,
        base_price=plan_in.base_price,
        min_quantity=plan_in.min_quantity,
        max_quantity=plan_in.max_quantity,
        start_date=plan_in.start_date,
        end_date=plan_in.end_date,
        description=plan_in.description,
        auto_close=plan_in.auto_close,
        allow_early_closure=plan_in.allow_early_closure,
        allow_pause=plan_in.allow_pause,
        allow_renewal=plan_in.allow_renewal,
        status=plan_in.status
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    audit = AuditLog(
        entity_type="subscription_plan",
        entity_id=new_plan.id,
        action="create",
        details=f"Plan created: {new_plan.name} ({new_plan.billing_interval}) at ₹{new_plan.base_price}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    res = PlanOut.model_validate(new_plan)
    res.product_name = prod.name
    return res

@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    res = PlanOut.model_validate(plan)
    res.product_name = plan.product.name if plan.product else None
    return res

@router.put("/{plan_id}", response_model=PlanOut)
def update_plan(
    plan_id: int,
    plan_update: PlanUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")

    for field, val in plan_update.model_dump(exclude_unset=True).items():
        setattr(plan, field, val)

    db.commit()
    db.refresh(plan)

    audit = AuditLog(
        entity_type="subscription_plan",
        entity_id=plan.id,
        action="update",
        details=f"Plan updated: {plan.name}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    res = PlanOut.model_validate(plan)
    res.product_name = plan.product.name if plan.product else None
    return res
