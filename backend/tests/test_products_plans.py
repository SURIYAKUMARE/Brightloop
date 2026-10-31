import pytest

def get_admin_token(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@brightloop.com",
        "password": "Admin@12345!"
    })
    return res.json()["access_token"]

def test_product_with_variants(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create product with Odoo variant (+₹560)
    res = client.post("/api/v1/products/", headers=headers, json={
        "name": "Brightloop Custom Software",
        "description": "Multi-tier software with pluggable modules",
        "product_type": "recurring_service",
        "sku": "BL-CS-TEST-01",
        "sales_price": "2000.00",
        "cost_price": "500.00",
        "variants": [
            {"name": "Standard", "sku": "BL-CS-STD", "additional_price": "0.00"},
            {"name": "Odoo Integration", "sku": "BL-CS-ODOO", "additional_price": "560.00"}
        ]
    })
    assert res.status_code == 200
    prod = res.json()
    assert prod["name"] == "Brightloop Custom Software"
    assert len(prod["variants"]) == 2

    # Verify additional price
    odoo_variant = next(v for v in prod["variants"] if v["name"] == "Odoo Integration")
    assert float(odoo_variant["additional_price"]) == 560.00

def test_plan_configuration_intervals(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Retrieve products
    prod_res = client.get("/api/v1/products/")
    prod_id = prod_res.json()[0]["id"]

    # Create monthly plan
    res_monthly = client.post("/api/v1/plans/", headers=headers, json={
        "name": "Test Monthly Tier",
        "product_id": prod_id,
        "billing_interval": "monthly",
        "base_price": "1999.00",
        "min_quantity": 1,
        "max_quantity": 50,
        "allow_pause": True,
        "allow_renewal": True
    })
    assert res_monthly.status_code == 200
    assert res_monthly.json()["billing_interval"] == "monthly"

    # Create yearly plan
    res_yearly = client.post("/api/v1/plans/", headers=headers, json={
        "name": "Test Yearly Tier",
        "product_id": prod_id,
        "billing_interval": "yearly",
        "base_price": "19990.00",
        "min_quantity": 1,
        "max_quantity": 50
    })
    assert res_yearly.status_code == 200
    assert res_yearly.json()["billing_interval"] == "yearly"
