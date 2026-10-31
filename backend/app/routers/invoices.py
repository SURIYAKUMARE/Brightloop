import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import (
    Invoice, InvoiceItem, Customer, Subscription, OrganizationSettings,
    User, AuditLog, Notification
)
from app.schemas import InvoiceCreate, InvoiceOut, InvoiceItemOut
from app.services.auth_service import get_current_user, require_staff_or_admin

router = APIRouter(prefix="/invoices", tags=["Invoices"])

@router.get("/", response_model=List[InvoiceOut])
def get_invoices(
    status_filter: Optional[str] = None,
    customer_id: Optional[int] = None,
    subscription_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Invoice)
    if current_user.role == "customer":
        if not current_user.customer_profile:
            return []
        query = query.filter(Invoice.customer_id == current_user.customer_profile.id)
    elif customer_id:
        query = query.filter(Invoice.customer_id == customer_id)

    if subscription_id:
        query = query.filter(Invoice.subscription_id == subscription_id)

    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    if search:
        s = f"%{search}%"
        query = query.filter(Invoice.invoice_number.ilike(s))

    invoices = query.order_by(Invoice.created_at.desc()).all()
    out = []
    for inv in invoices:
        item = InvoiceOut(
            id=inv.id,
            invoice_number=inv.invoice_number,
            customer_id=inv.customer_id,
            customer_name=inv.customer.name if inv.customer else None,
            customer_email=inv.customer.email if inv.customer else None,
            company_name=inv.customer.company_name if inv.customer else None,
            tax_id=inv.customer.tax_id if inv.customer else None,
            billing_address=inv.customer.billing_address if inv.customer else None,
            subscription_id=inv.subscription_id,
            subscription_number=inv.subscription.subscription_number if inv.subscription else None,
            status=inv.status,
            invoice_date=inv.invoice_date,
            due_date=inv.due_date,
            period_start=inv.period_start,
            period_end=inv.period_end,
            subtotal=inv.subtotal,
            tax_amount=inv.tax_amount,
            discount_amount=inv.discount_amount,
            total_amount=inv.total_amount,
            amount_paid=inv.amount_paid,
            balance_due=inv.balance_due,
            notes=inv.notes,
            items=[
                InvoiceItemOut(
                    id=ii.id,
                    product_id=ii.product_id,
                    variant_id=ii.variant_id,
                    description=ii.description,
                    quantity=ii.quantity,
                    unit_price=ii.unit_price,
                    tax_rate=ii.tax_rate,
                    discount_amount=ii.discount_amount,
                    total_price=ii.total_price
                ) for ii in inv.items
            ],
            created_at=inv.created_at,
            updated_at=inv.updated_at,
            version=inv.version
        )
        out.append(item)
    return out

@router.post("/", response_model=InvoiceOut)
def create_manual_invoice(
    inv_in: InvoiceCreate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == inv_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    inv_num = f"{settings.invoice_prefix}{settings.next_invoice_number:05d}"
    settings.next_invoice_number += 1

    subtotal = Decimal("0.00")
    tax_amount = Decimal("0.00")
    discount_amount = Decimal("0.00")

    items = []
    for item in inv_in.items:
        line_sub = item.unit_price * Decimal(item.quantity)
        line_disc = item.discount_amount
        line_taxable = line_sub - line_disc
        if line_taxable < Decimal("0.00"):
            line_taxable = Decimal("0.00")
        line_tax = (line_taxable * item.tax_rate) / Decimal("100.00")
        line_tot = line_taxable + line_tax

        subtotal += line_sub
        discount_amount += line_disc
        tax_amount += line_tax

        ii = InvoiceItem(
            product_id=item.product_id,
            variant_id=item.variant_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            tax_rate=item.tax_rate,
            discount_amount=item.discount_amount,
            total_price=line_tot
        )
        items.append(ii)

    total_amount = subtotal - discount_amount + tax_amount
    if total_amount < Decimal("0.00"):
        total_amount = Decimal("0.00")

    new_inv = Invoice(
        invoice_number=inv_num,
        customer_id=customer.id,
        subscription_id=inv_in.subscription_id,
        status="confirmed",
        invoice_date=inv_in.invoice_date,
        due_date=inv_in.due_date,
        period_start=inv_in.period_start,
        period_end=inv_in.period_end,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        amount_paid=Decimal("0.00"),
        balance_due=total_amount,
        notes=inv_in.notes,
        items=items,
        version=1
    )
    db.add(new_inv)

    customer.outstanding_balance += total_amount
    db.commit()
    db.refresh(new_inv)

    audit = AuditLog(
        entity_type="invoice",
        entity_id=new_inv.id,
        action="create",
        details=f"Invoice {inv_num} generated for {customer.name} (₹{total_amount:.2f})",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return get_invoice(new_inv.id, current_user, db)

@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if current_user.role == "customer" and (not current_user.customer_profile or current_user.customer_profile.id != inv.customer_id):
        raise HTTPException(status_code=403, detail="Access denied. Cannot view other customer invoice.")

    return InvoiceOut(
        id=inv.id,
        invoice_number=inv.invoice_number,
        customer_id=inv.customer_id,
        customer_name=inv.customer.name if inv.customer else None,
        customer_email=inv.customer.email if inv.customer else None,
        company_name=inv.customer.company_name if inv.customer else None,
        tax_id=inv.customer.tax_id if inv.customer else None,
        billing_address=inv.customer.billing_address if inv.customer else None,
        subscription_id=inv.subscription_id,
        subscription_number=inv.subscription.subscription_number if inv.subscription else None,
        status=inv.status,
        invoice_date=inv.invoice_date,
        due_date=inv.due_date,
        period_start=inv.period_start,
        period_end=inv.period_end,
        subtotal=inv.subtotal,
        tax_amount=inv.tax_amount,
        discount_amount=inv.discount_amount,
        total_amount=inv.total_amount,
        amount_paid=inv.amount_paid,
        balance_due=inv.balance_due,
        notes=inv.notes,
        items=[
            InvoiceItemOut(
                id=ii.id,
                product_id=ii.product_id,
                variant_id=ii.variant_id,
                description=ii.description,
                quantity=ii.quantity,
                unit_price=ii.unit_price,
                tax_rate=ii.tax_rate,
                discount_amount=ii.discount_amount,
                total_price=ii.total_price
            ) for ii in inv.items
        ],
        created_at=inv.created_at,
        updated_at=inv.updated_at,
        version=inv.version
    )

@router.post("/{invoice_id}/cancel", response_model=InvoiceOut)
def cancel_invoice(
    invoice_id: int,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel a fully paid invoice. Record a refund first.")

    old_balance = inv.balance_due
    inv.status = "cancelled"
    inv.balance_due = Decimal("0.00")

    # Revert customer outstanding balance
    if inv.customer and old_balance > Decimal("0.00"):
        inv.customer.outstanding_balance -= old_balance
        if inv.customer.outstanding_balance < Decimal("0.00"):
            inv.customer.outstanding_balance = Decimal("0.00")

    db.commit()
    db.refresh(inv)

    audit = AuditLog(
        entity_type="invoice",
        entity_id=inv.id,
        action="cancel",
        details=f"Invoice {inv.invoice_number} cancelled. Reverted balance of ₹{old_balance:.2f}.",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return get_invoice(inv.id, current_user, db)
