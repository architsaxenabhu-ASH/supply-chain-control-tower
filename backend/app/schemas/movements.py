from pydantic import BaseModel, Field


class MovementEvent(BaseModel):
    """A single goods movement: a receipt, dispatch, allocation, or adjustment.
    Quantity is signed: positive for inbound, negative for outbound."""

    event_id: str
    event_type: str
    item_code: str
    batch_number: str
    serial_number: str | None = None
    quantity: float
    warehouse: str | None = None
    counterparty: str | None = None
    reference: str | None = None
    actor: str | None = None
    occurred_at: str
    note: str | None = None


class RecordMovementRequest(BaseModel):
    event_type: str
    item_code: str
    batch_number: str
    serial_number: str | None = None
    quantity: float
    warehouse: str | None = None
    counterparty: str | None = None
    reference: str | None = None
    actor: str
    occurred_at: str | None = None
    note: str | None = None


class BatchTraceability(BaseModel):
    batch_number: str
    found: bool = False
    item_codes: list[str] = Field(default_factory=list)
    received_quantity: float = 0
    dispatched_quantity: float = 0
    allocated_quantity: float = 0
    current_quantity: float = 0
    remaining_quantity: float = 0
    expiry_date: str | None = None
    warehouses: list[str] = Field(default_factory=list)
    customers: list[str] = Field(default_factory=list)
    events: list[MovementEvent] = Field(default_factory=list)


class ProductJourney(BaseModel):
    query: str
    found: bool = False
    events: list[MovementEvent] = Field(default_factory=list)
