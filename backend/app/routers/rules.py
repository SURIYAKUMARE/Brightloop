from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TaxRule, DiscountRule, User, AuditLog
from app.schemas import (
    TaxRuleCreate, TaxRuleOut, DiscountRuleCreate, DiscountRuleOut
)
from app.services.auth_service import get_current_user, require_admin

router = APIRouter(tags=["Rules & Pricing"])

# ----------------- TAX RULES -----------------
@router.get("/taxes", response_model=List[TaxRuleOut])
def get_tax_rules(db: Session = Depends(get_db)):
    return db.query(TaxRule).order_by(TaxRule.rate_percentage.asc()).all()

@router.post("/taxes", response_model=TaxRuleOut)
def create_tax_rule(
    tax_in: TaxRuleCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    tax = TaxRule(
        name=tax_in.name,
        rate_percentage=tax_in.rate_percentage,
        is_compound=tax_in.is_compound,
        tax_type=tax_in.tax_type,
        is_active=tax_in.is_active
    )
    db.add(tax)
    db.commit()
    db.refresh(tax)

    audit = AuditLog(
        entity_type="tax_rule",
        entity_id=tax.id,
        action="create",
        details=f"Tax rule created: {tax.name} ({tax.rate_percentage}%)",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return tax

# ----------------- DISCOUNT RULES -----------------
@router.get("/discounts", response_model=List[DiscountRuleOut])
def get_discount_rules(db: Session = Depends(get_db)):
    return db.query(DiscountRule).order_by(DiscountRule.created_at.desc()).all()

@router.post("/discounts", response_model=DiscountRuleOut)
def create_discount_rule(
    disc_in: DiscountRuleCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(DiscountRule).filter(DiscountRule.code == disc_in.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists.")

    disc = DiscountRule(
        code=disc_in.code.upper(),
        name=disc_in.name,
        discount_type=disc_in.discount_type,
        value=disc_in.value,
        min_purchase_amount=disc_in.min_purchase_amount,
        min_quantity=disc_in.min_quantity,
        start_date=disc_in.start_date,
        expiry_date=disc_in.expiry_date,
        max_usage_count=disc_in.max_usage_count,
        product_id=disc_in.product_id,
        subscription_wide=disc_in.subscription_wide,
        is_active=disc_in.is_active
    )
    db.add(disc)
    db.commit()
    db.refresh(disc)

    audit = AuditLog(
        entity_type="discount_rule",
        entity_id=disc.id,
        action="create",
        details=f"Discount rule created: {disc.code} ({disc.discount_type} - {disc.value})",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return disc
