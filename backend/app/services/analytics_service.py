import datetime
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models import (
    Customer, Subscription, Invoice, Payment, SubscriptionPlan, Product
)

def get_dashboard_kpis(db: Session, date_filter: str = "this_month") -> Dict[str, Any]:
    """
    Computes real database-driven financial KPIs with Decimal precision.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    
    total_customers = db.query(Customer).filter(Customer.status != "archived").count()
    total_subscriptions = db.query(Subscription).count()
    active_subscriptions = db.query(Subscription).filter(Subscription.status == "active").count()

    # New subscriptions this month
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_subscriptions_month = db.query(Subscription).filter(Subscription.created_at >= first_of_month).count()

    # Calculate MRR (Monthly Recurring Revenue) based on active subscriptions
    active_subs = db.query(Subscription).filter(Subscription.status == "active").all()
    mrr = Decimal("0.00")
    for s in active_subs:
        if s.billing_interval == "monthly":
            mrr += s.total_amount
        elif s.billing_interval == "yearly":
            mrr += (s.total_amount / Decimal("12.00"))
        elif s.billing_interval == "weekly":
            mrr += (s.total_amount * Decimal("4.3333"))
        elif s.billing_interval == "daily":
            mrr += (s.total_amount * Decimal("30.00"))

    arr = mrr * Decimal("12.00")

    # Revenue collected & outstanding
    total_collected_res = db.query(func.sum(Payment.amount)).filter(Payment.status == "confirmed").scalar()
    revenue_collected = total_collected_res or Decimal("0.00")

    total_outstanding_res = db.query(func.sum(Invoice.balance_due)).filter(Invoice.status.in_(["confirmed", "partially_paid", "overdue"])).scalar()
    outstanding_revenue = total_outstanding_res or Decimal("0.00")

    # Overdue invoices
    overdue_invoices_count = db.query(Invoice).filter(
        or_(
            Invoice.status == "overdue",
            and_(Invoice.status.in_(["confirmed", "partially_paid"]), Invoice.due_date < now)
        )
    ).count()

    # Upcoming renewals (next 30 days)
    thirty_days_future = now + datetime.timedelta(days=30)
    upcoming_renewals_count = db.query(Subscription).filter(
        Subscription.status == "active",
        Subscription.next_billing_date >= now,
        Subscription.next_billing_date <= thirty_days_future
    ).count()

    # Churn rate: (cancelled + closed in last 30 days) / (active + cancelled in last 30 days) * 100
    thirty_days_ago = now - datetime.timedelta(days=30)
    churned_count = db.query(Subscription).filter(
        Subscription.status.in_(["cancelled", "closed"]),
        Subscription.updated_at >= thirty_days_ago
    ).count()

    denom = active_subscriptions + churned_count
    churn_rate = (Decimal(churned_count) / Decimal(denom) * Decimal("100.00")) if denom > 0 else Decimal("0.00")

    # ARPU (Average Revenue Per User / Customer)
    arpu = (mrr / Decimal(total_customers)) if total_customers > 0 else Decimal("0.00")

    return {
        "total_customers": total_customers,
        "total_subscriptions": total_subscriptions,
        "active_subscriptions": active_subscriptions,
        "new_subscriptions_month": new_subscriptions_month,
        "mrr": round(mrr, 2),
        "arr": round(arr, 2),
        "revenue_collected": round(revenue_collected, 2),
        "outstanding_revenue": round(outstanding_revenue, 2),
        "overdue_invoices_count": overdue_invoices_count,
        "upcoming_renewals_count": upcoming_renewals_count,
        "churn_rate": round(churn_rate, 2),
        "arpu": round(arpu, 2)
    }

def get_revenue_trends(db: Session) -> List[Dict[str, Any]]:
    """
    Computes monthly invoiced vs collected revenue for the last 6 months.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    trends = []

    for i in range(5, -1, -1):
        # Calculate month date window
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        
        start_date = datetime.datetime(year, month, 1, tzinfo=datetime.timezone.utc)
        if month == 12:
            end_date = datetime.datetime(year + 1, 1, 1, tzinfo=datetime.timezone.utc)
        else:
            end_date = datetime.datetime(year, month + 1, 1, tzinfo=datetime.timezone.utc)

        month_label = start_date.strftime("%b %Y")

        inv_sum = db.query(func.sum(Invoice.total_amount)).filter(
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date < end_date,
            Invoice.status != "cancelled"
        ).scalar() or Decimal("0.00")

        pay_sum = db.query(func.sum(Payment.amount)).filter(
            Payment.payment_date >= start_date,
            Payment.payment_date < end_date,
            Payment.status == "confirmed"
        ).scalar() or Decimal("0.00")

        trends.append({
            "month": month_label,
            "invoiced": float(round(inv_sum, 2)),
            "collected": float(round(pay_sum, 2))
        })

    return trends

def get_breakdowns(db: Session) -> Dict[str, Any]:
    """
    Breakdowns by plan, product, subscription status, and payment method.
    """
    # By Plan
    plans = db.query(SubscriptionPlan).all()
    plan_data = []
    for p in plans:
        count = db.query(Subscription).filter(Subscription.plan_id == p.id, Subscription.status == "active").count()
        rev = sum([s.total_amount for s in db.query(Subscription).filter(Subscription.plan_id == p.id, Subscription.status == "active").all()])
        plan_data.append({
            "name": p.name,
            "count": count,
            "revenue": float(round(rev, 2))
        })

    # By Status
    statuses = ["active", "draft", "confirmed", "paused", "pending_renewal", "expired", "cancelled", "closed"]
    status_distribution = []
    for s in statuses:
        c = db.query(Subscription).filter(Subscription.status == s).count()
        if c > 0:
            status_distribution.append({"status": s, "count": c})

    # By Payment Method
    methods = ["bank_transfer", "upi", "card", "cash", "other"]
    payment_method_dist = []
    for m in methods:
        amt = db.query(func.sum(Payment.amount)).filter(Payment.payment_method == m, Payment.status == "confirmed").scalar() or Decimal("0.00")
        if amt > Decimal("0.00"):
            payment_method_dist.append({"method": m.replace("_", " ").title(), "amount": float(round(amt, 2))})

    return {
        "by_plan": plan_data,
        "by_status": status_distribution,
        "by_payment_method": payment_method_dist
    }
