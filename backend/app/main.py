from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.audit_context import clear_audit_context, set_audit_context
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

# Writes that may run before a session exists (login establishes the token;
# the very first security user is a bootstrap and is guarded inside its handler).
AUTH_EXEMPT_WRITE_PATHS = {
    "/api/v1/security/login",
    "/api/v1/security/users",
    # Demo-presentation controls: a process-wide counter only, no business data,
    # so every device (including a manager in another city) can drive/see the
    # same live walkthrough without an authenticated session.
    "/api/v1/demo/reset",
    "/api/v1/demo/primary",
    "/api/v1/demo/secondary",
}
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _bearer_token(request: Request) -> str:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return ""


@app.middleware("http")
async def auth_and_attribution(request: Request, call_next):
    """Enforce authentication on every write and attach attribution (who/role/
    screen) to the request so audit events are fully attributed."""
    # Imported lazily to avoid import-time DB work.
    from app.services.security_repository import authenticate_token

    token = _bearer_token(request)
    user = None
    if token:
        try:
            user = authenticate_token(token)
        except ValueError:
            user = None

    if (
        request.method in WRITE_METHODS
        and request.url.path.startswith("/api/v1/")
        and request.url.path not in AUTH_EXEMPT_WRITE_PATHS
        and user is None
    ):
        return JSONResponse(status_code=401, content={"detail": "Authentication required for this action."})

    set_audit_context(
        email=user.email if user else None,
        role=user.role_name if user else None,
        source_screen=request.headers.get("x-source-screen"),
    )
    try:
        return await call_next(request)
    finally:
        clear_audit_context()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=(
        r"^https?://("
        r"localhost|127\.0\.0\.1|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"[a-zA-Z0-9-]+\.trycloudflare\.com"
        r")(:\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
