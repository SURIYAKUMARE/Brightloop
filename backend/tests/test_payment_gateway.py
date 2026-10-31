import json
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.models import Invoice, Customer, OrganizationSettings, Payment
from app.services.payment_gateway import RazorpayProvider, StripeProvider

def test_gateway_config(client: TestClient):
    """Verify gateway configuration returns public keys and active mode."""
    res = client.get("/api/v1/gateway/config")
    assert res.status_code == 200
    data = res.json()
    assert data["gateway_mode"] == "sandbox"
    assert data["razorpay_enabled"] is True
    assert "rzp_test_" in data["razorpay_key_id"]
    assert data["stripe_enabled"] is True
    assert "pk_test_" in data["stripe_publishable_key"]

def test_create_gateway_order(client: TestClient, db):
    """Test order creation for an existing unpaid invoice."""
    # Obtain admin token
    auth_res = client.post("/api/v1/auth/login", json={"email": "admin@brightloop.com", "password": "Admin@12345!"})
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Find an unpaid or draft invoice
    invoice = db.query(Invoice).filter(Invoice.balance_due > Decimal("0.00")).first()
    assert invoice is not None

    # Create order via Razorpay
    order_req = {
        "invoice_id": invoice.id,
        "provider": "razorpay"
    }
    res = client.post("/api/v1/gateway/create-order", json=order_req, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "razorpay"
    assert data["order_id"].startswith("order_rzp_")
    assert float(data["amount"]) == float(invoice.balance_due)
    assert data["invoice_id"] == invoice.id

    # Create order via Stripe
    order_req_stripe = {
        "invoice_id": invoice.id,
        "provider": "stripe"
    }
    res_stripe = client.post("/api/v1/gateway/create-order", json=order_req_stripe, headers=headers)
    assert res_stripe.status_code == 200
    data_stripe = res_stripe.json()
    assert data_stripe["provider"] == "stripe"
    assert data_stripe["order_id"].startswith("pi_mock_")

def test_verify_client_payment(client: TestClient, db):
    """Test client-side checkout verification and automatic invoice reconciliation."""
    auth_res = client.post("/api/v1/auth/login", json={"email": "admin@brightloop.com", "password": "Admin@12345!"})
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    invoice = db.query(Invoice).filter(Invoice.balance_due > Decimal("0.00")).first()
    initial_balance = invoice.balance_due

    # Generate valid Razorpay signature
    order_id = "order_rzp_test_checkout_123"
    payment_id = "pay_rzp_test_checkout_456"
    settings = db.query(OrganizationSettings).first()
    provider = RazorpayProvider(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret,
        webhook_secret=settings.razorpay_webhook_secret
    )
    valid_sig = provider.generate_payment_signature(order_id, payment_id)

    verify_req = {
        "provider": "razorpay",
        "invoice_id": invoice.id,
        "order_id": order_id,
        "payment_id": payment_id,
        "signature": valid_sig
    }

    res = client.post("/api/v1/gateway/verify-payment", json=verify_req, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["verified"] is True
    assert data["reconciled"] is True
    assert data["invoice_status"] == "paid"

    # Verify db reflects updated status
    db.refresh(invoice)
    assert invoice.balance_due == Decimal("0.00")
    assert invoice.status == "paid"

def test_razorpay_webhook_hmac_validation(client: TestClient, db):
    """Test webhook rejection when HMAC-SHA256 signature is invalid or tampered."""
    invoice = db.query(Invoice).first()
    settings = db.query(OrganizationSettings).first()
    provider = RazorpayProvider(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret,
        webhook_secret=settings.razorpay_webhook_secret
    )

    payload = provider.build_mock_webhook_payload(
        event_type="payment.captured",
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        amount=Decimal("1500.00")
    )
    raw_body = json.dumps(payload)

    # 1. Tampered signature should fail with 400
    bad_headers = {
        "X-Razorpay-Signature": "invalid_signature_hash_12345",
        "Content-Type": "application/json"
    }
    bad_res = client.post("/api/v1/gateway/webhook/razorpay", content=raw_body, headers=bad_headers)
    assert bad_res.status_code == 400
    assert "Invalid webhook signature" in bad_res.json()["detail"]

    # 2. Genuine signature should succeed
    valid_sig = provider.generate_webhook_signature(raw_body)
    good_headers = {
        "X-Razorpay-Signature": valid_sig,
        "Content-Type": "application/json"
    }
    good_res = client.post("/api/v1/gateway/webhook/razorpay", content=raw_body, headers=good_headers)
    assert good_res.status_code == 200
    assert good_res.json()["received"] is True
    assert good_res.json()["event"] == "payment.captured"

def test_stripe_webhook_timestamped_hmac(client: TestClient, db):
    """Test Stripe v1 timestamped HMAC-SHA256 signature validation."""
    invoice = db.query(Invoice).first()
    settings = db.query(OrganizationSettings).first()
    provider = StripeProvider(
        publishable_key=settings.stripe_publishable_key,
        secret_key=settings.stripe_secret_key,
        webhook_secret=settings.stripe_webhook_secret
    )

    payload = provider.build_mock_webhook_payload(
        event_type="payment_intent.succeeded",
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        amount=Decimal("2000.00")
    )
    raw_body = json.dumps(payload)

    # 1. Invalid signature
    bad_res = client.post(
        "/api/v1/gateway/webhook/stripe",
        content=raw_body,
        headers={"Stripe-Signature": "t=1600000000,v1=tampered_v1_sig", "Content-Type": "application/json"}
    )
    assert bad_res.status_code == 400

    # 2. Authentic signature
    valid_header = provider.generate_webhook_signature(raw_body)
    good_res = client.post(
        "/api/v1/gateway/webhook/stripe",
        content=raw_body,
        headers={"Stripe-Signature": valid_header, "Content-Type": "application/json"}
    )
    assert good_res.status_code == 200
    assert good_res.json()["received"] is True
    assert good_res.json()["event"] == "payment_intent.succeeded"

def test_simulate_webhook_developer_tool(client: TestClient, db):
    """Test developer sandbox simulation endpoint for testing webhook flows without external tools."""
    auth_res = client.post("/api/v1/auth/login", json={"email": "admin@brightloop.com", "password": "Admin@12345!"})
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    invoice = db.query(Invoice).first()

    # 1. Successful simulation
    sim_req = {
        "provider": "razorpay",
        "event_type": "payment.captured",
        "invoice_id": invoice.id,
        "amount": 999.00,
        "simulate_signature_failure": False
    }
    res = client.post("/api/v1/gateway/simulate-webhook", json=sim_req, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["signature_valid"] is True
    assert data["reconciled"] is True

    # 2. Simulated signature failure
    fail_sim_req = {
        "provider": "razorpay",
        "event_type": "payment.captured",
        "invoice_id": invoice.id,
        "simulate_signature_failure": True
    }
    res_fail = client.post("/api/v1/gateway/simulate-webhook", json=fail_sim_req, headers=headers)
    assert res_fail.status_code == 200
    data_fail = res_fail.json()
    assert data_fail["success"] is False
    assert data_fail["signature_valid"] is False
    assert data_fail["reconciled"] is False

def test_gateway_transactions_list(client: TestClient, db):
    """Test retrieving transactions created by payment gateways."""
    auth_res = client.post("/api/v1/auth/login", json={"email": "admin@brightloop.com", "password": "Admin@12345!"})
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    invoice = db.query(Invoice).first()
    # Trigger a simulated webhook to guarantee a transaction exists
    client.post("/api/v1/gateway/simulate-webhook", json={
        "provider": "razorpay",
        "event_type": "payment.captured",
        "invoice_id": invoice.id,
        "amount": 500.00
    }, headers=headers)

    res = client.get("/api/v1/gateway/transactions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(tx["gateway_provider"] in ["razorpay", "stripe"] for tx in data)
