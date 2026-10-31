import pytest

def test_customer_cannot_access_other_customer_data(client):
    # Login as customer (Vikram Nair, linked to Customer 1)
    login_res = client.post("/api/v1/auth/login", json={
        "email": "customer@brightloop.com",
        "password": "Customer@12345!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Customer fetching customer list should ONLY see themselves
    cust_res = client.get("/api/v1/customers/", headers=headers)
    assert cust_res.status_code == 200
    custs = cust_res.json()
    assert len(custs) == 1
    assert custs[0]["email"] == "customer@brightloop.com"

    # Customer attempting to access Customer 2 directly -> 403 Forbidden
    direct_res = client.get("/api/v1/customers/2", headers=headers)
    assert direct_res.status_code == 403
    assert "Cannot view other customer data" in direct_res.json()["detail"]

def test_staff_cannot_perform_admin_only_operations(client):
    # Login as staff (Alex Rivera)
    login_res = client.post("/api/v1/auth/login", json={
        "email": "staff@brightloop.com",
        "password": "Staff@12345!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Staff trying to create a new user / staff member -> 403 Forbidden
    user_create_res = client.post("/api/v1/users/", headers=headers, json={
        "email": "unauthorized@brightloop.com",
        "password": "Password123!",
        "full_name": "Unauthorized User",
        "role": "staff"
    })
    assert user_create_res.status_code == 403

    # Staff trying to create a tax rule -> 403 Forbidden
    tax_res = client.post("/api/v1/taxes", headers=headers, json={
        "name": "Illegal Tax",
        "rate_percentage": "10.00"
    })
    assert tax_res.status_code == 403
