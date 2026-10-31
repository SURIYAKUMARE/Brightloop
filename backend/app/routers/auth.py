from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Customer, OrganizationSettings, AuditLog
from app.schemas import UserCreate, UserLogin, Token, UserOut, PasswordResetRequest, PasswordResetConfirm
from app.services.auth_service import (
    validate_password_strength, hash_password, verify_password,
    create_access_token, get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    validate_password_strength(user_in.password)
    
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # First user is automatically admin, otherwise role in user_in (or customer)
    user_count = db.query(User).count()
    assigned_role = "admin" if user_count == 0 else user_in.role

    hashed = hash_password(user_in.password)
    new_user = User(
        email=user_in.email,
        password_hash=hashed,
        full_name=user_in.full_name,
        role=assigned_role,
        phone=user_in.phone,
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If role is customer, also create or link Customer record
    customer_id = None
    if assigned_role == "customer":
        cust = Customer(
            user_id=new_user.id,
            name=new_user.full_name,
            email=new_user.email,
            phone=new_user.phone,
            status="active"
        )
        db.add(cust)
        db.commit()
        db.refresh(cust)
        customer_id = cust.id

    audit = AuditLog(
        entity_type="user",
        entity_id=new_user.id,
        action="register",
        details=f"User registered with role {assigned_role}",
        user_id=new_user.id
    )
    db.add(audit)
    db.commit()

    token = create_access_token({"sub": str(new_user.id), "role": new_user.role, "email": new_user.email})
    user_out = UserOut(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        status=new_user.status,
        phone=new_user.phone,
        avatar_url=new_user.avatar_url,
        customer_id=customer_id,
        created_at=new_user.created_at
    )
    return {"access_token": token, "token_type": "bearer", "user": user_out}

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive or suspended. Please contact your administrator."
        )

    customer_id = None
    if user.customer_profile:
        customer_id = user.customer_profile.id

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        phone=user.phone,
        avatar_url=user.avatar_url,
        customer_id=customer_id,
        created_at=user.created_at
    )
    return {"access_token": token, "token_type": "bearer", "user": user_out}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    customer_id = current_user.customer_profile.id if current_user.customer_profile else None
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        status=current_user.status,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        customer_id=customer_id,
        created_at=current_user.created_at
    )

@router.post("/forgot-password")
def forgot_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Don't leak user existence in production, return generic success
        return {"message": "If an account with this email exists, a password reset link has been dispatched."}
    
    # In development / sandbox, acknowledge request
    return {"message": "Password reset instructions dispatched to your email address."}

@router.post("/reset-password")
def reset_password(req: PasswordResetConfirm, db: Session = Depends(get_db)):
    validate_password_strength(req.new_password)
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user.password_hash = hash_password(req.new_password)
    db.commit()

    audit = AuditLog(
        entity_type="user",
        entity_id=user.id,
        action="reset_password",
        details="User password was successfully reset",
        user_id=user.id
    )
    db.add(audit)
    db.commit()

    return {"message": "Password successfully reset. You may now log in with your new credentials."}
