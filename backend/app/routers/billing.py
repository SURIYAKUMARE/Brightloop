from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import BillingJob, User, AuditLog
from app.schemas import BillingRunResult
from app.services.billing_engine import run_billing_cycle
from app.services.auth_service import require_admin

router = APIRouter(prefix="/billing", tags=["Recurring Billing Engine"])

@router.post("/run-cycle", response_model=BillingRunResult)
def trigger_billing_cycle(
    force_subscription_id: Optional[int] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    result = run_billing_cycle(db, force_subscription_id=force_subscription_id)

    audit = AuditLog(
        entity_type="billing_engine",
        entity_id=None,
        action="manual_run",
        details=f"Billing cycle executed by admin. Invoices: {result['invoices_generated']}, Total: ₹{result['total_billed']:.2f}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return result

@router.get("/jobs")
def get_billing_jobs(
    limit: int = 20,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return db.query(BillingJob).order_by(BillingJob.run_at.desc()).limit(limit).all()
