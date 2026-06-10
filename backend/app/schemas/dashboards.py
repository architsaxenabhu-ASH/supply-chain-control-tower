from pydantic import BaseModel, Field


class ExecutiveDashboard(BaseModel):
    total_inventory_value: float = 0
    total_inventory_quantity: float = 0
    open_import_shipments: int = 0
    imports_in_transit: int = 0
    imports_awaiting_receipt: int = 0
    imports_received: int = 0
    open_shipment_requests: int = 0
    dispatched_shipments: int = 0
    delivered_shipments: int = 0
    expiry_risk_90: int = 0
    expired_inventory: int = 0
    active_warehouses: int = 0
    active_countries: int = 0
    learning_rules: int = 0
    audit_events: int = 0


class InventoryDashboard(BaseModel):
    total_value: float = 0
    total_quantity: float = 0
    batch_count: int = 0
    by_warehouse_value: dict[str, float] = Field(default_factory=dict)
    by_category_value: dict[str, float] = Field(default_factory=dict)
    expiring_30: int = 0
    expiring_60: int = 0
    expiring_90: int = 0
    expired: int = 0


class ImportDashboard(BaseModel):
    total: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    open_shipments: int = 0
    awaiting_receipt: int = 0
    received: int = 0
    by_country: dict[str, int] = Field(default_factory=dict)


class ExpiryRiskBatch(BaseModel):
    item_code: str
    batch_number: str
    warehouse: str
    expiry_date: str
    days_to_expiry: int
    quantity: float
    value: float


class ExpiryDashboard(BaseModel):
    expiring_30: int = 0
    expiring_60: int = 0
    expiring_90: int = 0
    expiring_180: int = 0
    expired: int = 0
    value_at_risk_90: float = 0
    by_warehouse_90: dict[str, int] = Field(default_factory=dict)
    soonest: list[ExpiryRiskBatch] = Field(default_factory=list)


class ShipmentDashboard(BaseModel):
    total: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    dispatched: int = 0
    delivered: int = 0
    by_country: dict[str, int] = Field(default_factory=dict)
