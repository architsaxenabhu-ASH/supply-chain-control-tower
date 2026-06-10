from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class MasterEntityType(str, Enum):
    PRODUCT = "product"
    CUSTOMER = "customer"
    SUPPLIER = "supplier"
    WAREHOUSE = "warehouse"
    CARRIER = "carrier"
    COUNTRY = "country"


class MasterRecord(BaseModel):
    entity_type: str
    code: str
    name: str
    is_active: bool = True
    attributes: dict[str, str] = Field(default_factory=dict)
    created_by: str | None = None
    created_at: datetime | None = None
    updated_by: str | None = None
    updated_at: datetime | None = None


class UpsertMasterRecordRequest(BaseModel):
    entity_type: MasterEntityType
    code: str
    name: str
    attributes: dict[str, str] = Field(default_factory=dict)
    is_active: bool = True
    actor: str


class SetMasterStatusRequest(BaseModel):
    entity_type: MasterEntityType
    code: str
    is_active: bool
    actor: str


class DuplicateCheckResponse(BaseModel):
    entity_type: str
    code: str
    is_duplicate: bool
    existing: MasterRecord | None = None
