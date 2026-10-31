from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Customer, User, AuditLog
from app.schemas import CustomerCreate, CustomerUpdate, CustomerOut
from app.services.auth_service import get_current_user, require_staff_or_admin

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("/", response_model=List[CustomerOut])
def get_customers(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Customer data isolation
    if current_user.role == "customer":
        if not current_user.customer_profile:
            return []
        return [current_user.customer_profile]

    query = db.query(Customer)
    if status_filter:
        query = query.filter(Customer.status == status_filter)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(s),
                Customer.email.ilike(s),
                Customer.company_name.ilike(s),
                Customer.phone.ilike(s),
                Customer.tax_id.ilike(s)
            )
        )
    return query.order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/", response_model=CustomerOut)
def create_customer(
    cust_in: CustomerCreate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    new_cust = Customer(
        name=cust_in.name,
        email=cust_in.email,
        phone=cust_in.phone,
        company_name=cust_in.company_name,
        tax_id=cust_in.tax_id,
        billing_address=cust_in.billing_address,
        shipping_address=cust_in.shipping_address,
        currency=cust_in.currency,
        notes=cust_in.notes,
        status=cust_in.status,
        version=1
    )
    db.add(new_cust)
    db.commit()
    db.refresh(new_cust)

    audit = AuditLog(
        entity_type="customer",
        entity_id=new_cust.id,
        action="create",
        details=f"Customer created: {new_cust.name} ({new_cust.email})",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return new_cust

@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")

    if current_user.role == "customer" and (not current_user.customer_profile or current_user.customer_profile.id != customer_id):
        raise HTTPException(status_code=403, detail="Access denied. Cannot view other customer data.")

    return cust

@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    cust_update: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")

    if current_user.role == "customer" and (not current_user.customer_profile or current_user.customer_profile.id != customer_id):
        raise HTTPException(status_code=403, detail="Access denied. Cannot update other customer data.")

    for field, val in cust_update.model_dump(exclude_unset=True).items():
        setattr(cust, field, val)

    cust.version += 1
    db.commit()
    db.refresh(cust)

    audit = AuditLog(
        entity_type="customer",
        entity_id=cust.id,
        action="update",
        details=f"Customer updated: {cust.name}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return cust
