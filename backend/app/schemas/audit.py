from typing import Any

from pydantic import BaseModel


class AuditEvent(BaseModel):
    id: int
    action: str
    module_name: str
    entity_name: str
    entity_id: str
    actor: str | None = None
    reason: str | None = None
    old_value: Any | None = None
    new_value: Any | None = None
    created_at: str
    event_hash: str | None = None
    actor_role: str | None = None
    source_screen: str | None = None
