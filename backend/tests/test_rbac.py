"""RBAC: country-scoped approvals and admin-only security management."""

import pytest

from app.services import security_repository as sr
from app.schemas.security import SecurityUser


def _user(role: str, country_scope: list[str]) -> SecurityUser:
    return SecurityUser(
        email="user@example.com",
        full_name="Test User",
        role_name=role,
        country_scope=country_scope,
    )


def test_admin_bypasses_country_scope():
    # Should not raise.
    sr.ensure_country_scope(_user("Admin", []), "Germany", "approve imports")


def test_scoped_user_allowed_for_assigned_country():
    sr.ensure_country_scope(_user("Country Incharge", ["Italy"]), "Italy", "approve imports")


def test_scoped_user_blocked_for_other_country():
    with pytest.raises(ValueError):
        sr.ensure_country_scope(_user("Country Incharge", ["Italy"]), "Germany", "approve imports")


def test_empty_scope_blocks_everything():
    with pytest.raises(ValueError):
        sr.ensure_country_scope(_user("Country Incharge", []), "Italy", "approve imports")


def test_scope_all_allows_any_country():
    sr.ensure_country_scope(_user("Country Incharge", ["All"]), "Brazil", "approve imports")


def test_require_admin_rejects_non_admin(monkeypatch):
    monkeypatch.setattr(sr, "authenticate_token", lambda _token: _user("Country Incharge", ["Italy"]))
    with pytest.raises(ValueError):
        sr.require_admin("session-token", "manage users")


def test_require_admin_allows_admin(monkeypatch):
    monkeypatch.setattr(sr, "authenticate_token", lambda _token: _user("Admin", []))
    assert sr.require_admin("session-token", "manage users").role_name == "Admin"
