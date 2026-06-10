"""Per-request attribution context.

The auth middleware sets the authenticated user (email, role) and the source
screen for the current request here, so ``record_audit_event`` can attach full
attribution without every call site having to pass it.
"""

from __future__ import annotations

import contextvars

_actor_email: contextvars.ContextVar[str | None] = contextvars.ContextVar("actor_email", default=None)
_actor_role: contextvars.ContextVar[str | None] = contextvars.ContextVar("actor_role", default=None)
_source_screen: contextvars.ContextVar[str | None] = contextvars.ContextVar("source_screen", default=None)


def set_audit_context(email: str | None, role: str | None, source_screen: str | None) -> None:
    _actor_email.set(email)
    _actor_role.set(role)
    _source_screen.set(source_screen)


def clear_audit_context() -> None:
    _actor_email.set(None)
    _actor_role.set(None)
    _source_screen.set(None)


def current_actor_email() -> str | None:
    return _actor_email.get()


def current_actor_role() -> str | None:
    return _actor_role.get()


def current_source_screen() -> str | None:
    return _source_screen.get()
