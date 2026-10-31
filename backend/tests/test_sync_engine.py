import pytest

def get_admin_token(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@brightloop.com",
        "password": "Admin@12345!"
    })
    return res.json()["access_token"]

def test_offline_batch_sync(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Simulate client offline mutation queue
    mutation1 = {
        "client_mutation_id": "client-offline-uuid-001",
        "entity_type": "customer",
        "action": "create",
        "client_version": 1,
        "payload": {
            "name": "Offline Created Customer Pvt Ltd",
            "email": "offline_client@brightloop.com",
            "phone": "+91 99999 88888",
            "company_name": "Offline Synced Co",
            "currency": "INR"
        }
    }

    res_sync = client.post("/api/v1/sync/batch", headers=headers, json={
        "mutations": [mutation1]
    })
    assert res_sync.status_code == 200
    data = res_sync.json()
    assert data["success_count"] == 1
    assert data["results"][0]["status"] == "applied"
    server_id = data["results"][0]["server_id"]

    # Test conflict detection with mismatched client version
    mutation_conflict = {
        "client_mutation_id": "client-offline-uuid-002",
        "entity_type": "customer",
        "action": "update",
        "client_version": 999,  # Stale version!
        "payload": {
            "id": server_id,
            "name": "Conflicting Update Name"
        }
    }
    res_conflict = client.post("/api/v1/sync/batch", headers=headers, json={
        "mutations": [mutation_conflict]
    })
    assert res_conflict.status_code == 200
    conflict_data = res_conflict.json()
    assert conflict_data["conflict_count"] == 1
    assert conflict_data["results"][0]["status"] == "conflict"
