from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Customer, AuditLog
from app.schemas import UserCreate, UserUpdate, UserOut
from app.services.auth_service import require_admin, hash_password, validate_password_strength

router = APIRouter(prefix="/users", tags=["User & Staff Management"])

@router.get("/", response_model=List[UserOut])
def get_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        cid = u.customer_profile.id if u.customer_profile else None
        out.append(
            UserOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                status=u.status,
                phone=u.phone,
                avatar_url=u.avatar_url,
                customer_id=cid,
                created_at=u.created_at
            )
        )
    return out

@router.post("/", response_model=UserOut)
def create_staff_or_admin(
    user_in: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Only administrators can add new staff members or admins.
    """
    validate_password_strength(user_in.password)
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email address already exists.")

    new_user = User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        phone=user_in.phone,
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    audit = AuditLog(
        entity_type="user",
        entity_id=new_user.id,
        action="admin_create_user",
        details=f"Admin created {new_user.role} user: {new_user.email}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return UserOut(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        status=new_user.status,
        phone=new_user.phone,
        avatar_url=new_user.avatar_url,
        customer_id=None,
        created_at=new_user.created_at
    )

@router.patch("/{user_id}", response_model=UserOut)
def update_user_status(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if target_user.id == current_user.id and user_update.status == "inactive":
        raise HTTPException(status_code=400, detail="Administrators cannot deactivate their own account.")

    for field, val in user_update.model_dump(exclude_unset=True).items():
        setattr(target_user, field, val)

    db.commit()
    db.refresh(target_user)

    audit = AuditLog(
        entity_type="user",
        entity_id=target_user.id,
        action="update_status",
        details=f"User {target_user.email} updated: status={target_user.status}, role={target_user.role}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    cid = target_user.customer_profile.id if target_user.customer_profile else None
    return UserOut(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_user.role,
        status=target_user.status,
        phone=target_user.phone,
        avatar_url=target_user.avatar_url,
        customer_id=cid,
        created_at=target_user.created_at
    )
