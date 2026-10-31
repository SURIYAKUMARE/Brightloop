import json
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Invoice, OrganizationSettings, Payment, User
from app.schemas import (
    GatewayConfigOut, GatewayCreateOrderRequest, GatewayOrderResponse,
    GatewayVerifyPaymentRequest, GatewaySimulateWebhookRequest,
    GatewaySimulateWebhookResponse, PaymentOut, PaymentAllocationOut
)
from app.services.auth_service import get_current_user, require_staff_or_admin
from app.services.payment_gateway import get_gateway_provider, reconcile_gateway_transaction

router = APIRouter(prefix="/gateway", tags=["Payment Gateway Sandbox"])

@router.get("/config", response_model=GatewayConfigOut)
def get_gateway_config(db: Session = Depends(get_db)):
    """
    Returns public gateway configuration and publishable API keys.
    """
    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return GatewayConfigOut(
        gateway_mode=getattr(settings, "gateway_mode", "sandbox"),
        razorpay_enabled=True,
        razorpay_key_id=getattr(settings, "razorpay_key_id", "rzp_test_brightloop123"),
        stripe_enabled=True,
        stripe_publishable_key=getattr(settings, "stripe_publishable_key", "pk_test_brightloop_stripe")
    )

@router.post("/create-order", response_model=GatewayOrderResponse)
def create_gateway_order(
    req: GatewayCreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiates a checkout order for an invoice with Razorpay or Stripe.
    """
    invoice = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if invoice.status == "paid":
        raise HTTPException(status_code=400, detail="Invoice has already been paid in full.")

    # Isolation check: customer can only pay their own invoices
    if current_user.role == "customer":
        if not current_user.customer_profile or invoice.customer_id != current_user.customer_profile.id:
            raise HTTPException(status_code=403, detail="Not authorized to pay this invoice.")

    settings = db.query(OrganizationSettings).first()
    provider = get_gateway_provider(req.provider, settings)

    amount_to_pay = req.amount if (req.amount and req.amount > Decimal("0.00")) else invoice.balance_due
    customer_name = invoice.customer.name if invoice.customer else "Valued Customer"
    customer_email = invoice.customer.email if invoice.customer else current_user.email

    order_payload = provider.create_order(
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        amount=amount_to_pay,
        currency="INR",
        customer_name=customer_name,
        customer_email=customer_email
    )

    return GatewayOrderResponse(
        order_id=order_payload["order_id"],
        amount=order_payload["amount"],
        currency=order_payload["currency"],
        provider=req.provider.lower(),
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        customer_name=customer_name,
        customer_email=customer_email,
        publishable_key=order_payload["publishable_key"],
        notes=f"Order for {invoice.invoice_number}"
    )

@router.post("/verify-payment")
def verify_client_payment(
    req: GatewayVerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifies client-side payment completion token/signature from Razorpay or Stripe.
    Performs server-authoritative reconciliation upon successful verification.
    """
    invoice = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    settings = db.query(OrganizationSettings).first()
    provider = get_gateway_provider(req.provider, settings)

    # Verify signature
    is_valid = provider.verify_payment_signature(
        order_id=req.order_id,
        payment_id=req.payment_id,
        signature=req.signature
    )

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Payment verification failed: Invalid payment signature or checksum mismatch."
        )

    # Reconcile server-authoritatively
    event_data = {
        "provider": req.provider.lower(),
        "event_type": "checkout.verified",
        "success": True,
        "invoice_id": invoice.id,
        "order_id": req.order_id,
        "payment_id": req.payment_id,
        "amount": invoice.balance_due,
        "currency": "INR",
        "transaction_reference": f"{req.provider.upper()}-{req.payment_id}",
        "method": "upi" if req.provider.lower() == "razorpay" else "card"
    }

    result = reconcile_gateway_transaction(
        db=db,
        event_data=event_data,
        raw_payload_str=json.dumps(req.model_dump())
    )

    return {
        "verified": True,
        "reconciled": result["reconciled"],
        "payment_id": result.get("payment_id"),
        "payment_number": result.get("payment_number"),
        "invoice_status": result.get("invoice_status"),
        "message": result["message"]
    }

@router.post("/webhook/{provider_name}")
async def handle_gateway_webhook(
    provider_name: str,
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature")
):
    """
    Unified Webhook Listener for Razorpay and Stripe.
    Validates HMAC-SHA256 signature against raw request body before processing.
    """
    raw_body_bytes = await request.body()
    raw_body_str = raw_body_bytes.decode("utf-8")

    settings = db.query(OrganizationSettings).first()
    provider = get_gateway_provider(provider_name, settings)

    # Determine signature header
    sig_header = x_razorpay_signature if provider_name.lower() == "razorpay" else stripe_signature
    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing webhook signature header for provider '{provider_name}'."
        )

    # Validate HMAC signature
    is_valid = provider.verify_webhook_signature(raw_body_str, sig_header)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature: HMAC validation failed."
        )

    try:
        payload = json.loads(raw_body_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    event_data = provider.parse_webhook_event(payload)
    result = reconcile_gateway_transaction(db, event_data, raw_payload_str=raw_body_str)

    return {
        "received": True,
        "event": event_data.get("event_type"),
        "reconciled": result.get("reconciled", False),
        "invoice_status": result.get("invoice_status"),
        "message": result.get("message")
    }

@router.post("/simulate-webhook", response_model=GatewaySimulateWebhookResponse)
def simulate_webhook_event(
    req: GatewaySimulateWebhookRequest,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    """
    Developer Sandbox Simulator:
    Generates genuine webhook payload with HMAC-SHA256 signature and executes
    the end-to-end webhook ingestion and reconciliation lifecycle.
    """
    invoice = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    settings = db.query(OrganizationSettings).first()
    provider = get_gateway_provider(req.provider, settings)

    amount = req.amount if (req.amount and req.amount > Decimal("0.00")) else invoice.balance_due

    # 1. Build authentic provider mock payload
    payload = provider.build_mock_webhook_payload(
        event_type=req.event_type,
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        amount=amount,
        currency="INR"
    )
    raw_payload_str = json.dumps(payload)

    # 2. Generate authentic HMAC signature
    if req.provider.lower() == "razorpay":
        computed_sig = provider.generate_webhook_signature(raw_payload_str)
    else:
        computed_sig = provider.generate_webhook_signature(raw_payload_str)

    # If simulation intentionally triggers failure
    if req.simulate_signature_failure:
        test_sig = computed_sig + "_tampered_bad_sig"
    else:
        test_sig = computed_sig

    # 3. Execute signature verification
    sig_valid = provider.verify_webhook_signature(raw_payload_str, test_sig)
    if not sig_valid:
        return GatewaySimulateWebhookResponse(
            success=False,
            event=req.event_type,
            signature_valid=False,
            reconciled=False,
            invoice_status=invoice.status,
            message="HMAC signature verification failed. Webhook rejected as untrusted."
        )

    # 4. Parse normalized event and reconcile
    event_data = provider.parse_webhook_event(payload)
    reconcile_res = reconcile_gateway_transaction(db, event_data, raw_payload_str=raw_payload_str)

    return GatewaySimulateWebhookResponse(
        success=True,
        event=req.event_type,
        signature_valid=True,
        reconciled=reconcile_res.get("reconciled", False),
        invoice_status=reconcile_res.get("invoice_status", invoice.status),
        payment_id=reconcile_res.get("payment_id"),
        payment_number=reconcile_res.get("payment_number"),
        message=reconcile_res.get("message", "Simulation completed successfully.")
    )

@router.get("/transactions", response_model=List[PaymentOut])
def get_gateway_transactions(
    provider: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns payment history specifically originating from payment gateways.
    """
    query = db.query(Payment).filter(Payment.gateway_provider.isnot(None))

    if current_user.role == "customer":
        if not current_user.customer_profile:
            return []
        query = query.filter(Payment.customer_id == current_user.customer_profile.id)

    if provider:
        query = query.filter(Payment.gateway_provider == provider.lower())

    payments = query.order_by(Payment.payment_date.desc()).all()
    out = []
    for p in payments:
        out.append(PaymentOut(
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
            gateway_provider=p.gateway_provider,
            gateway_order_id=p.gateway_order_id,
            gateway_payment_id=p.gateway_payment_id,
            allocations=[
                PaymentAllocationOut(
                    id=pa.id,
                    invoice_id=pa.invoice_id,
                    invoice_number=pa.invoice.invoice_number if pa.invoice else None,
                    allocated_amount=pa.allocated_amount
                ) for pa in p.allocations
            ],
            created_at=p.created_at
        ))
    return out
