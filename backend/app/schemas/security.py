from pydantic import BaseModel


class RoleDefinition(BaseModel):
    role_name: str
    description: str
    permissions: list[str]


class SecurityUser(BaseModel):
    email: str
    full_name: str
    role_name: str
    country_scope: list[str] = []
    warehouse_scope: list[str] = []
    is_active: bool = True
    has_password: bool = False
    created_at: str | None = None
    updated_at: str | None = None


class SaveSecurityUserRequest(BaseModel):
    email: str
    full_name: str
    role_name: str
    country_scope: list[str] = []
    warehouse_scope: list[str] = []
    is_active: bool = True
    password: str | None = None
    changed_by: str
    change_reason: str
    auth_token: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthenticatedUser(BaseModel):
    email: str
    full_name: str
    role_name: str
    country_scope: list[str] = []
    warehouse_scope: list[str] = []
    permissions: list[str] = []
    session_token: str


class ApprovalRule(BaseModel):
    rule_id: str
    process_name: str
    country: str
    vertical: str = "All"
    material_code: str = "All"
    approver_role: str
    approver_email: str
    is_active: bool = True
    created_at: str | None = None
    updated_at: str | None = None


class SaveApprovalRuleRequest(BaseModel):
    process_name: str
    country: str
    vertical: str = "All"
    material_code: str = "All"
    approver_role: str
    approver_email: str
    is_active: bool = True
    changed_by: str
    change_reason: str
    auth_token: str = ""


class ApprovalResolutionRequest(BaseModel):
    process_name: str
    country: str
    vertical: str = "All"
    material_code: str = "All"


class ApprovalResolution(BaseModel):
    matched_rule_id: str | None
    approver_role: str | None
    approver_email: str | None
    message: str


class SecurityOverview(BaseModel):
    role_definitions: list[RoleDefinition]
    users: list[SecurityUser]
    approval_rules: list[ApprovalRule]
