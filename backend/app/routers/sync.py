from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, SyncOperation, AuditLog
from app.schemas import SyncBatchRequest, SyncBatchResponse, ConflictResolveRequest
from app.services.sync_service import process_batch_sync
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/sync", tags=["Offline Synchronization Engine"])

@router.post("/batch", response_model=SyncBatchResponse)
def sync_batch(
    req: SyncBatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = process_batch_sync(db, req.mutations, user_id=current_user.id)

    audit = AuditLog(
        entity_type="sync_engine",
        entity_id=None,
        action="batch_sync",
        details=f"Sync batch executed: {result['success_count']} success, {result['conflict_count']} conflicts/errors",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return result

@router.get("/operations")
def get_sync_operations(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(SyncOperation).order_by(SyncOperation.applied_at.desc()).limit(limit).all()

@router.post("/resolve-conflict")
def resolve_conflict(
    res_in: ConflictResolveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    op = db.query(SyncOperation).filter(SyncOperation.client_mutation_id == res_in.client_mutation_id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Sync mutation record not found.")

    op.status = "resolved"
    op.conflict_details = f"Resolved via {res_in.resolution_choice}"
    db.commit()

    return {"message": "Conflict marked as resolved.", "client_mutation_id": op.client_mutation_id}
