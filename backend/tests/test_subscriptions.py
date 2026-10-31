import pytest

def get_admin_token(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@brightloop.com",
        "password": "Admin@12345!"
    })
    return res.json()["access_token"]

def test_subscription_lifecycle(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch existing customer and product
    customers = client.get("/api/v1/customers/", headers=headers).json()
    cust_id = customers[0]["id"]
    products = client.get("/api/v1/products/").json()
    prod = products[0]

    # Create new subscription
    res_sub = client.post("/api/v1/subscriptions/", headers=headers, json={
        "customer_id": cust_id,
        "start_date": "2026-11-01T00:00:00Z",
        "billing_interval": "monthly",
        "payment_terms": "immediate",
        "auto_renew": True,
        "allow_pause": True,
        "allow_early_closure": True,
        "items": [
            {
                "product_id": prod["id"],
                "description": prod["name"],
                "quantity": 1,
                "unit_price": str(prod["sales_price"]),
                "tax_rate": "18.00",
                "discount_amount": "0.00"
            }
        ]
    })
    assert res_sub.status_code == 200
    sub = res_sub.json()
    sub_id = sub["id"]
    assert sub["status"] == "active"
    assert len(sub["timeline"]) >= 1

    # Pause subscription
    res_pause = client.post(f"/api/v1/subscriptions/{sub_id}/action", headers=headers, json={
        "action": "pause",
        "reason": "Customer temporary holiday hiatus"
    })
    assert res_pause.status_code == 200
    assert res_pause.json()["status"] == "paused"

    # Resume subscription
    res_resume = client.post(f"/api/v1/subscriptions/{sub_id}/action", headers=headers, json={
        "action": "resume"
    })
    assert res_resume.status_code == 200
    assert res_resume.json()["status"] == "active"

    # Cancel subscription
    res_cancel = client.post(f"/api/v1/subscriptions/{sub_id}/action", headers=headers, json={
        "action": "cancel",
        "reason": "Business consolidation"
    })
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "cancelled"
