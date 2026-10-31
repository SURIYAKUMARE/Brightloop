import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Payment, PaymentAllocation, Invoice, Customer, OrganizationSettings,
    User, AuditLog, Notification
)
from app.schemas import PaymentCreate, PaymentOut, PaymentAllocationOut, ReconciliationRequest
from app.services.auth_service import get_current_user, require_staff_or_admin

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.get("/", response_model=List[PaymentOut])
def get_payments(
    customer_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Payment)
    if current_user.role == "customer":
        if not current_user.customer_profile:
            return []
        query = query.filter(Payment.customer_id == current_user.customer_profile.id)
    elif customer_id:
        query = query.filter(Payment.customer_id == customer_id)

    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)

    if status_filter:
        query = query.filter(Payment.status == status_filter)

    payments = query.order_by(Payment.payment_date.desc()).all()
    out = []
    for p in payments:
        item = PaymentOut(
            id=p.id,
            payment_number=p.payment_number,
            invoice_id=p.invoice_id,
            invoice_number=p.invoice.invoice_number if p.invoice else None,
            customer_id=p.customer_id,
            customer_name=p.customer.name if p.customer else None,
            payment_method=p.payment_method,
            amount=p.amount,
            payment_date=p.payment_date,
            transaction_reference=p.transaction_reference,
            notes=p.notes,
            status=p.status,
            allocations=[
                PaymentAllocationOut(
                    id=pa.id,
                    invoice_id=pa.invoice_id,
                    invoice_number=pa.invoice.invoice_number if pa.invoice else None,
                    allocated_amount=pa.allocated_amount
                ) for pa in p.allocations
            ],
            created_at=p.created_at
        )
        out.append(item)
    return out

@router.post("/", response_model=PaymentOut)
def record_payment(
    pay_in: PaymentCreate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == pay_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    if pay_in.amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    pay_num = f"{settings.payment_prefix}{settings.next_payment_number:05d}"
    settings.next_payment_number += 1

    new_payment = Payment(
        payment_number=pay_num,
        invoice_id=pay_in.invoice_id,
        customer_id=customer.id,
        payment_method=pay_in.payment_method,
        amount=pay_in.amount,
        payment_date=pay_in.payment_date,
        transaction_reference=pay_in.transaction_reference,
        notes=pay_in.notes,
        status="confirmed",
        created_by_id=current_user.id
    )
    db.add(new_payment)
    db.flush()

    # If linked to a specific invoice, allocate and update invoice balance
    if pay_in.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == pay_in.invoice_id).first()
        if invoice:
            alloc_amount = min(pay_in.amount, invoice.balance_due)
            alloc = PaymentAllocation(
                payment_id=new_payment.id,
                invoice_id=invoice.id,
                allocated_amount=alloc_amount
            )
            db.add(alloc)

            invoice.amount_paid += alloc_amount
            invoice.balance_due -= alloc_amount
            if invoice.balance_due <= Decimal("0.00"):
                invoice.balance_due = Decimal("0.00")
                invoice.status = "paid"
            else:
                invoice.status = "partially_paid"

    # Reduce customer overall outstanding balance
    customer.outstanding_balance -= pay_in.amount
    if customer.outstanding_balance < Decimal("0.00"):
        customer.outstanding_balance = Decimal("0.00")

    db.commit()
    db.refresh(new_payment)

    audit = AuditLog(
        entity_type="payment",
        entity_id=new_payment.id,
        action="record_payment",
        details=f"Payment {pay_num} recorded for ₹{pay_in.amount:.2f} via {pay_in.payment_method} ({customer.name})",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return PaymentOut(
        id=new_payment.id,
        payment_number=new_payment.payment_number,
        invoice_id=new_payment.invoice_id,
        invoice_number=new_payment.invoice.invoice_number if new_payment.invoice else None,
        customer_id=customer.id,
        customer_name=customer.name,
        payment_method=new_payment.payment_method,
        amount=new_payment.amount,
        payment_date=new_payment.payment_date,
        transaction_reference=new_payment.transaction_reference,
        notes=new_payment.notes,
        status=new_payment.status,
        allocations=[
            PaymentAllocationOut(
                id=pa.id,
                invoice_id=pa.invoice_id,
                invoice_number=pa.invoice.invoice_number if pa.invoice else None,
                allocated_amount=pa.allocated_amount
            ) for pa in new_payment.allocations
        ],
        created_at=new_payment.created_at
    )

@router.post("/reconcile")
def reconcile_payment(
    rec_in: ReconciliationRequest,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    payment = db.query(Payment).filter(Payment.id == rec_in.payment_id).first()
    invoice = db.query(Invoice).filter(Invoice.id == rec_in.invoice_id).first()
    if not payment or not invoice:
        raise HTTPException(status_code=404, detail="Payment or Invoice not found.")

    if rec_in.amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Reconciliation amount must be greater than zero.")

    if rec_in.amount > invoice.balance_due:
        raise HTTPException(status_code=400, detail="Reconciliation amount exceeds outstanding invoice balance.")

    alloc = PaymentAllocation(
        payment_id=payment.id,
        invoice_id=invoice.id,
        allocated_amount=rec_in.amount
    )
    db.add(alloc)

    invoice.amount_paid += rec_in.amount
    invoice.balance_due -= rec_in.amount
    if invoice.balance_due <= Decimal("0.00"):
        invoice.balance_due = Decimal("0.00")
        invoice.status = "paid"
    else:
        invoice.status = "partially_paid"

    db.commit()

    audit = AuditLog(
        entity_type="payment_reconciliation",
        entity_id=payment.id,
        action="reconcile",
        details=f"Reconciled ₹{rec_in.amount:.2f} from Payment {payment.payment_number} to Invoice {invoice.invoice_number}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return {
        "message": "Payment successfully reconciled against invoice.",
        "invoice_number": invoice.invoice_number,
        "new_balance_due": float(invoice.balance_due),
        "status": invoice.status
    }
