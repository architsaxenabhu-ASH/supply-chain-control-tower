"""Full authentication enforcement: no anonymous writes; attribution recorded."""

from fastapi.testclient import TestClient

from app.main import app
from app.db.local_persistence import list_audit_events
from app.schemas.security import SaveSecurityUserRequest
from app.services.security_repository import save_security_user

client = TestClient(app)


def _login_token() -> str:
    # First user is a bootstrap (no token needed); then log in for a real session.
    save_security_user(
        SaveSecurityUserRequest(
            email="admin@test.com",
            full_name="Admin",
            role_name="Admin",
            password="password123",
            changed_by="seed",
            change_reason="seed",
        )
    )
    response = client.post(
        "/api/v1/security/login",
        json={"email": "admin@test.com", "password": "password123"},
    )
    assert response.status_code == 200
    return response.json()["session_token"]


def test_write_without_token_is_rejected():
    response = client.post(
        "/api/v1/products",
        json={"item_code": "ANON-1", "product_description": "x", "product_category": "c", "uom": "EA"},
    )
    assert response.status_code == 401


def test_write_with_token_is_allowed_and_attributed():
    token = _login_token()
    response = client.post(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {token}", "X-Source-Screen": "products"},
        json={"item_code": "AUTH-1", "product_description": "Device", "product_category": "Cardio", "uom": "EA"},
    )
    assert response.status_code == 200

    # Attribution: the create is audited with the actor's role and source screen.
    events = list_audit_events(limit=20)
    product_events = [e for e in events if e["entity_id"] == "AUTH-1"]
    assert product_events, "expected an audit event for the created product"
    assert product_events[0]["source_screen"] == "products"
    assert product_events[0]["actor_role"] == "Admin"


def test_read_without_token_is_allowed():
    # Reads are not blocked (only writes require authentication).
    response = client.get("/api/v1/products")
    assert response.status_code == 200
