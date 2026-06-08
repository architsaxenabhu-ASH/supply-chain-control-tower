from __future__ import annotations

import re
from datetime import UTC, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.security import (
    ApprovalResolution,
    ApprovalResolutionRequest,
    ApprovalRule,
    RoleDefinition,
    SaveApprovalRuleRequest,
    SaveSecurityUserRequest,
    SecurityOverview,
    SecurityUser,
)


ROLE_DEFINITIONS = [
    RoleDefinition(
        role_name="Admin",
        description="System setup and full control",
        permissions=["masters", "security", "imports", "inventory", "shipments", "audit"],
    ),
    RoleDefinition(
        role_name="Country Incharge",
        description="Country-level import and shipment approval",
        permissions=["import_approval", "shipment_approval", "country_dashboard"],
    ),
    RoleDefinition(
        role_name="Warehouse Executive",
        description="Goods receipt, dispatch, and cycle count entry",
        permissions=["goods_receipt", "dispatch", "inventory_count"],
    ),
    RoleDefinition(
        role_name="Warehouse Manager",
        description="Warehouse approval and reconciliation",
        permissions=["inventory_approval", "dispatch_approval", "reconciliation"],
    ),
    RoleDefinition(
        role_name="Sales User",
        description="Shipment request and customer visibility",
        permissions=["shipment_request", "customer_read"],
    ),
    RoleDefinition(
        role_name="Finance User",
        description="Inventory value and export visibility",
        permissions=["inventory_value", "reports_export"],
    ),
    RoleDefinition(
        role_name="QA User",
        description="Expiry, batch, and compliance review",
        permissions=["expiry_review", "batch_traceability", "quality_hold"],
    ),
]


def get_security_overview() -> SecurityOverview:
    return SecurityOverview(
        role_definitions=ROLE_DEFINITIONS,
        users=list_security_users(),
        approval_rules=list_approval_rules(),
    )


def list_security_users() -> list[SecurityUser]:
    return load_collection("security_users", lambda payload: SecurityUser(**payload))


def list_approval_rules() -> list[ApprovalRule]:
    return load_collection("security_approval_rules", lambda payload: ApprovalRule(**payload))


def save_security_user(request: SaveSecurityUserRequest) -> SecurityUser:
    email = normalize_email(request.email)
    if not is_valid_email(email):
        raise ValueError("Enter a valid email address.")
    require_role(request.role_name)
    require_change_context(request.changed_by, request.change_reason)

    now = datetime.now(UTC).isoformat()
    users = list_security_users()
    existing = next((user for user in users if user.email == email), None)
    user = SecurityUser(
        email=email,
        full_name=request.full_name.strip(),
        role_name=request.role_name,
        country_scope=normalize_scope(request.country_scope),
        warehouse_scope=normalize_scope(request.warehouse_scope),
        is_active=request.is_active,
        created_at=existing.created_at if existing else now,
        updated_at=now,
    )
    if not user.full_name:
        raise ValueError("Full name is mandatory.")

    save_collection(
        "security_users",
        [user, *[saved_user for saved_user in users if saved_user.email != email]],
        lambda saved_user: saved_user.email,
    )
    record_audit_event(
        action="upsert_user",
        module_name="security",
        entity_name="user",
        entity_id=user.email,
        actor=request.changed_by,
        reason=request.change_reason,
        old_value=existing,
        new_value=user,
    )
    return user


def save_approval_rule(request: SaveApprovalRuleRequest) -> ApprovalRule:
    require_role(request.approver_role)
    approver_email = normalize_email(request.approver_email)
    if not is_valid_email(approver_email):
        raise ValueError("Enter a valid approver email address.")
    require_change_context(request.changed_by, request.change_reason)

    process_name = normalize_key(request.process_name)
    country = request.country.strip()
    vertical = request.vertical.strip() or "All"
    material_code = request.material_code.strip() or "All"
    if not process_name or not country:
        raise ValueError("Process and country are mandatory.")

    matching_user = next((user for user in list_security_users() if user.email == approver_email), None)
    if not matching_user:
        raise ValueError("Save approver as an active security user first.")
    if not matching_user.is_active:
        raise ValueError("Approver user is inactive.")
    if matching_user.role_name != request.approver_role:
        raise ValueError("Approver email is assigned to a different role.")
    if matching_user.country_scope and not any(
        same_or_all(scope, country) for scope in matching_user.country_scope
    ):
        raise ValueError("Approver user is not scoped to this country.")

    now = datetime.now(UTC).isoformat()
    rule_id = build_rule_id(process_name, country, vertical, material_code)
    rules = list_approval_rules()
    existing = next((rule for rule in rules if rule.rule_id == rule_id), None)
    rule = ApprovalRule(
        rule_id=rule_id,
        process_name=process_name,
        country=country,
        vertical=vertical,
        material_code=material_code,
        approver_role=request.approver_role,
        approver_email=approver_email,
        is_active=request.is_active,
        created_at=existing.created_at if existing else now,
        updated_at=now,
    )
    save_collection(
        "security_approval_rules",
        [rule, *[saved_rule for saved_rule in rules if saved_rule.rule_id != rule_id]],
        lambda saved_rule: saved_rule.rule_id,
    )
    record_audit_event(
        action="upsert_approval_rule",
        module_name="security",
        entity_name="approval_rule",
        entity_id=rule.rule_id,
        actor=request.changed_by,
        reason=request.change_reason,
        old_value=existing,
        new_value=rule,
    )
    return rule


def resolve_approver(request: ApprovalResolutionRequest) -> ApprovalResolution:
    process_name = normalize_key(request.process_name)
    candidates = [
        rule for rule in list_approval_rules()
        if rule.is_active
        and rule.process_name == process_name
        and same_or_all(rule.country, request.country)
        and same_or_all(rule.vertical, request.vertical)
        and same_or_all(rule.material_code, request.material_code)
    ]
    if not candidates:
        return ApprovalResolution(
            matched_rule_id=None,
            approver_role=None,
            approver_email=None,
            message="No approval rule found. Ask Admin to configure an approver.",
        )

    rule = sorted(candidates, key=rule_specificity, reverse=True)[0]
    return ApprovalResolution(
        matched_rule_id=rule.rule_id,
        approver_role=rule.approver_role,
        approver_email=rule.approver_email,
        message="Approver resolved from configured approval rules.",
    )


def require_role(role_name: str) -> None:
    valid_roles = {role.role_name for role in ROLE_DEFINITIONS}
    if role_name not in valid_roles:
        raise ValueError("Select a valid role.")


def require_change_context(changed_by: str, change_reason: str) -> None:
    if not changed_by.strip():
        raise ValueError("Changed by is mandatory.")
    if not change_reason.strip():
        raise ValueError("Change reason is mandatory.")


def normalize_scope(values: list[str]) -> list[str]:
    return [value.strip() for value in values if value.strip()]


def normalize_email(value: str) -> str:
    return value.strip().lower()


def normalize_key(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def is_valid_email(value: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))


def build_rule_id(process_name: str, country: str, vertical: str, material_code: str) -> str:
    parts = [process_name, country, vertical, material_code]
    return "APR-" + "-".join(re.sub(r"[^A-Za-z0-9]+", "-", part.strip()).strip("-").upper() for part in parts)


def same_or_all(rule_value: str, requested_value: str) -> bool:
    return rule_value.lower() == "all" or rule_value.lower() == requested_value.strip().lower()


def rule_specificity(rule: ApprovalRule) -> int:
    return sum(
        1
        for value in [rule.country, rule.vertical, rule.material_code]
        if value.lower() != "all"
    )
