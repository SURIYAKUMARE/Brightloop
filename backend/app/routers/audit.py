from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuditLog, User
from app.schemas import AuditLogOut
from app.services.auth_service import require_admin

router = APIRouter(prefix="/audit", tags=["Audit & Compliance"])

@router.get("/logs", response_model=List[AuditLogOut])
def get_audit_logs(
    entity_type: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    out = []
    for log in logs:
        out.append(
            AuditLogOut(
                id=log.id,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                action=log.action,
                details=log.details,
                user_email=log.user.email if log.user else "System",
                ip_address=log.ip_address,
                created_at=log.created_at
            )
        )
    return out
