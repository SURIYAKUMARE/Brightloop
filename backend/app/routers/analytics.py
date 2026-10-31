from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import DashboardKPIs
from app.services.analytics_service import get_dashboard_kpis, get_revenue_trends, get_breakdowns
from app.services.auth_service import get_current_user, require_staff_or_admin

router = APIRouter(prefix="/analytics", tags=["Analytics & Reporting"])

@router.get("/kpis", response_model=DashboardKPIs)
def get_kpis(
    date_filter: str = Query("this_month", regex="^(today|this_week|this_month|this_quarter|this_year|all)$"),
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    return get_dashboard_kpis(db, date_filter=date_filter)

@router.get("/trends")
def get_trends(
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    return get_revenue_trends(db)

@router.get("/breakdowns")
def get_dashboard_breakdowns(
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    return get_breakdowns(db)
