from datetime import date
from enum import Enum

from pydantic import BaseModel


class ProductStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ShipmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Product(BaseModel):
    item_code: str
    product_description: str
    product_category: str
    uom: str
    product_status: ProductStatus
    shelf_life_months: int | None = None


class Customer(BaseModel):
    customer_code: str
    customer_name: str
    country: str
    customer_type: str
    contact_person: str


class WarehouseLocation(BaseModel):
    warehouse_code: str
    warehouse_name: str
    country: str
    is_active: bool = True


class InventoryBatch(BaseModel):
    item_code: str
    product_description: str
    product_category: str
    batch_number: str
    warehouse_location: str
    quantity_available: float
    manufacturing_date: date
    expiry_date: date
    unit_value: float
    inventory_value: float
    days_to_expiry: int
    expiry_bucket: str
    # Invoice currency the unit value was captured in (None = base currency).
    currency: str | None = None


class ShipmentLine(BaseModel):
    shipment_id: str
    item_code: str
    batch_number: str
    warehouse_location: str | None = None
    quantity_requested: float
    quantity_approved: float


class ShipmentRequest(BaseModel):
    shipment_id: str
    request_date: date
    requestor_name: str
    customer_name: str
    destination_country: str
    priority: str
    required_delivery_date: date
    status: ShipmentStatus
    lines: list[ShipmentLine]


class Dispatch(BaseModel):
    dispatch_number: str
    shipment_id: str
    dispatch_date: date
    transporter_courier: str
    tracking_number: str
    dispatched_by: str
    status: str


class GoodsReceiptLine(BaseModel):
    item_code: str
    batch_number: str
    quantity_received: float
    expiry_date: date
    unit_value: float
    currency: str | None = None


class GoodsReceipt(BaseModel):
    grn_number: str
    receipt_date: date
    warehouse: str
    supplier: str
    status: str
    lines: list[GoodsReceiptLine]


class PhysicalInventoryCountLine(BaseModel):
    item_code: str
    batch_number: str
    system_quantity: float
    physical_quantity: float
    variance_quantity: float
    variance_type: str


class PhysicalInventoryCount(BaseModel):
    inventory_count_id: str
    count_date: date
    warehouse: str
    status: str
    lines: list[PhysicalInventoryCountLine]


class DashboardSummary(BaseModel):
    total_inventory_value: float
    total_inventory_quantity: float
    inventory_by_warehouse: dict[str, float]
    inventory_by_category: dict[str, float]
    expiring_stock_alerts: int
    expiring_in_30_days: int
    expiring_in_60_days: int
    expiring_in_90_days: int
    expired_inventory_count: int
    open_shipment_requests: int
    dispatched_shipments: int
    goods_received_today: int
    inventory_variance_summary: dict[str, float]
    top_customers: list[dict[str, str | int]]


class AssistantQuery(BaseModel):
    question: str


class AssistantAnswer(BaseModel):
    question: str
    answer: str
    data: list[dict[str, object]]


class WorkflowResult(BaseModel):
    status: str
    message: str
    data: dict[str, object] = {}


class CreateProductRequest(BaseModel):
    item_code: str
    product_description: str
    product_category: str
    uom: str
    product_status: ProductStatus = ProductStatus.ACTIVE
    shelf_life_months: int | None = None


class CreateGoodsReceiptLineRequest(BaseModel):
    item_code: str
    batch_number: str
    quantity_received: float
    manufacturing_date: date | None = None
    expiry_date: date
    unit_value: float
    currency: str | None = None


class CreateGoodsReceiptRequest(BaseModel):
    grn_number: str
    receipt_date: date
    warehouse: str
    supplier: str
    lines: list[CreateGoodsReceiptLineRequest]


class CreateShipmentLineRequest(BaseModel):
    item_code: str
    batch_number: str
    warehouse_location: str
    quantity_requested: float


class CreateShipmentRequest(BaseModel):
    request_date: date
    requestor_name: str
    customer_name: str
    destination_country: str
    priority: str
    required_delivery_date: date
    lines: list[CreateShipmentLineRequest]
    auth_token: str
    submit_for_approval: bool = True


class ShipmentApprovalLineRequest(BaseModel):
    item_code: str
    batch_number: str
    warehouse_location: str | None = None
    quantity_approved: float


class ShipmentApprovalRequest(BaseModel):
    approved_by: str
    lines: list[ShipmentApprovalLineRequest]
    auth_token: str


class CreateDispatchRequest(BaseModel):
    dispatch_number: str
    dispatch_date: date
    transporter_courier: str
    tracking_number: str
    dispatched_by: str
    auth_token: str


class CreateInventoryCountLineRequest(BaseModel):
    item_code: str
    batch_number: str
    system_quantity: float
    physical_quantity: float


class CreateInventoryCountRequest(BaseModel):
    inventory_count_id: str
    count_date: date
    warehouse: str
    counted_by: str
    lines: list[CreateInventoryCountLineRequest]
