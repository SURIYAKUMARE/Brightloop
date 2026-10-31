from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import OrganizationSettings, User, AuditLog
from app.schemas import SettingsOut, SettingsUpdate
from app.services.auth_service import require_admin, get_current_user

router = APIRouter(prefix="/settings", tags=["Organization Settings"])

@router.get("/", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/", response_model=SettingsOut)
def update_settings(
    settings_in: SettingsUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)

    for field, val in settings_in.model_dump(exclude_unset=True).items():
        setattr(settings, field, val)

    db.commit()
    db.refresh(settings)

    audit = AuditLog(
        entity_type="organization_settings",
        entity_id=settings.id,
        action="update_settings",
        details="Organization settings modified",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return settings
