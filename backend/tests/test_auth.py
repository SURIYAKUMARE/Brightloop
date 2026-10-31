import pytest

def test_login_success(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@brightloop.com",
        "password": "Admin@12345!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

def test_login_invalid_credentials(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@brightloop.com",
        "password": "WrongPassword99!"
    })
    assert res.status_code == 401

def test_password_policy_validation(client):
    # Too short (< 9 chars)
    res = client.post("/api/v1/auth/register", json={
        "email": "testshort@brightloop.com",
        "password": "Ab1!",
        "full_name": "Test User"
    })
    assert res.status_code == 400
    assert "greater than 8" in res.json()["detail"]

    # Missing uppercase
    res = client.post("/api/v1/auth/register", json={
        "email": "testnoupper@brightloop.com",
        "password": "password123!",
        "full_name": "Test User"
    })
    assert res.status_code == 400
    assert "uppercase" in res.json()["detail"]

    # Missing special character
    res = client.post("/api/v1/auth/register", json={
        "email": "testnospec@brightloop.com",
        "password": "Password123",
        "full_name": "Test User"
    })
    assert res.status_code == 400
    assert "special character" in res.json()["detail"]

def test_valid_registration(client):
    res = client.post("/api/v1/auth/register", json={
        "email": "newcustomer@nexus.io",
        "password": "Valid@Pass1234!",
        "full_name": "New Enterprise Customer",
        "role": "customer"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["email"] == "newcustomer@nexus.io"
    assert data["user"]["customer_id"] is not None

def test_duplicate_registration_fails(client):
    res = client.post("/api/v1/auth/register", json={
        "email": "admin@brightloop.com",
        "password": "Admin@12345!",
        "full_name": "Duplicate Admin"
    })
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]
