import pytest

def get_admin_token(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@brightloop.com",
        "password": "Admin@12345!"
    })
    return res.json()["access_token"]

def test_billing_engine_and_duplicate_prevention(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Run billing cycle
    res_run1 = client.post("/api/v1/billing/run-cycle", headers=headers)
    assert res_run1.status_code == 200
    data1 = res_run1.json()
    assert "subscriptions_processed" in data1
    assert "total_billed" in data1

    # Run billing cycle immediately again -> must NOT produce duplicates
    res_run2 = client.post("/api/v1/billing/run-cycle", headers=headers)
    assert res_run2.status_code == 200
    data2 = res_run2.json()
    assert data2["invoices_generated"] == 0  # Idempotency safeguards prevented duplicate invoices!

def test_partial_payment_and_reconciliation(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    invoices = client.get("/api/v1/invoices/", headers=headers).json()
    unpaid_inv = next(i for i in invoices if float(i["balance_due"]) > 0)
    inv_id = unpaid_inv["id"]
    cust_id = unpaid_inv["customer_id"]
    initial_balance = float(unpaid_inv["balance_due"])

    # Make partial payment of 500
    pay_res = client.post("/api/v1/payments/", headers=headers, json={
        "customer_id": cust_id,
        "invoice_id": inv_id,
        "payment_method": "upi",
        "amount": "500.00",
        "payment_date": "2026-10-31T10:00:00Z",
        "transaction_reference": "TEST_UPI_123456"
    })
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    assert float(pay_data["amount"]) == 500.00

    # Verify updated invoice balance
    updated_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=headers).json()
    assert float(updated_inv["balance_due"]) == round(initial_balance - 500.00, 2)
    assert updated_inv["status"] in ["partially_paid", "paid"]
