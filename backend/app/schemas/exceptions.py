from pydantic import BaseModel


class OperationalException(BaseModel):
    exception_id: str
    exception_type: str
    severity: str  # low | medium | high | critical
    title: str
    owner: str | None = None
    status: str = "open"  # open | in_progress | resolved
    root_cause: str | None = None
    resolution: str | None = None
    related_entity: str | None = None
    related_record: str | None = None
    created_at: str
    updated_at: str | None = None


class ExceptionUpdateRequest(BaseModel):
    owner: str | None = None
    status: str | None = None
    root_cause: str | None = None
    resolution: str | None = None
    actor: str
