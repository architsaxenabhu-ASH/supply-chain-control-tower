from datetime import date

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.warehouse import (
    AssistantAnswer,
    CreateCustomerRequest,
    CreateDispatchRequest,
    CreateGoodsReceiptRequest,
    CreateInventoryCountRequest,
    CreateProductRequest,
    CreateShipmentRequest,
    Customer,
    DashboardSummary,
    Dispatch,
    GoodsReceipt,
    GoodsReceiptLine,
    InventoryBatch,
    PhysicalInventoryCount,
    PhysicalInventoryCountLine,
    Product,
    ProductStatus,
    ShipmentApprovalRequest,
    ShipmentLine,
    ShipmentRequest,
    ShipmentStatus,
    WarehouseLocation,
    WorkflowResult,
)
from app.services.security_repository import ensure_country_scope, normalize_email, require_user_permission


TODAY = date.today()

PRODUCTS = [
    Product(
        item_code="AOAC-10/35",
        product_description="Aortic Occlusion Catheter 10/35",
        product_category="Cardio",
        uom="EA",
        product_status=ProductStatus.ACTIVE,
    ),
    Product(
        item_code="MYVAL-THV-26",
        product_description="Myval Transcatheter Heart Valve 26mm",
        product_category="Cardio",
        uom="EA",
        product_status=ProductStatus.ACTIVE,
    ),
    Product(
        item_code="ENDO-STENT-08",
        product_description="Endoscopy Stent 8mm",
        product_category="Endo",
        uom="EA",
        product_status=ProductStatus.ACTIVE,
    ),
]

CUSTOMERS = [
    Customer(
        customer_code="CUST-APOLLO",
        customer_name="Apollo Hospital",
        country="India",
        city="Mumbai",
        customer_type="Hospital",
        contact_person="Procurement Head",
    ),
    Customer(
        customer_code="CUST-MEDANTA",
        customer_name="Medanta Hospital",
        country="India",
        city="Delhi",
        customer_type="Hospital",
        contact_person="Cath Lab Manager",
    ),
    Customer(
        customer_code="CUST-DHA",
        customer_name="Dubai Health Authority",
        country="UAE",
        city="Dubai",
        customer_type="Distributor",
        contact_person="Supply Chain Lead",
    ),
]

WAREHOUSES = [
    WarehouseLocation(
        warehouse_code="WH-IN-MUM",
        warehouse_name="Mumbai WH",
        country="India",
    ),
    WarehouseLocation(
        warehouse_code="WH-IN-DEL",
        warehouse_name="Delhi WH",
        country="India",
    ),
]

RAW_BATCHES = [
    {
        "item_code": "AOAC-10/35",
        "batch_number": "AOAC-B2401",
        "warehouse_location": "Mumbai WH",
        "quantity_available": 120.0,
        "manufacturing_date": date(2025, 1, 10),
        "expiry_date": date(2026, 9, 30),
        "unit_value": 1250.0,
    },
    {
        "item_code": "MYVAL-THV-26",
        "batch_number": "B240501",
        "warehouse_location": "Mumbai WH",
        "quantity_available": 25.0,
        "manufacturing_date": date(2025, 5, 1),
        "expiry_date": date(2026, 8, 15),
        "unit_value": 18400.0,
    },
    {
        "item_code": "ENDO-STENT-08",
        "batch_number": "ES-2502",
        "warehouse_location": "Delhi WH",
        "quantity_available": 210.0,
        "manufacturing_date": date(2025, 2, 14),
        "expiry_date": date(2027, 2, 14),
        "unit_value": 780.0,
    },
]

SHIPMENTS = [
    ShipmentRequest(
        shipment_id="SHP-2026-0001",
        request_date=date(2026, 6, 7),
        requestor_name="Sales North",
        customer_name="Apollo Hospital",
        destination_country="India",
        priority="urgent",
        required_delivery_date=date(2026, 6, 10),
        status=ShipmentStatus.DISPATCHED,
        lines=[
            ShipmentLine(
                shipment_id="SHP-2026-0001",
                item_code="MYVAL-THV-26",
                batch_number="B240501",
                warehouse_location="Mumbai WH",
                quantity_requested=5,
                quantity_approved=5,
            )
        ],
    ),
    ShipmentRequest(
        shipment_id="SHP-2026-0002",
        request_date=date(2026, 6, 6),
        requestor_name="Export Sales",
        customer_name="Dubai Health Authority",
        destination_country="UAE",
        priority="normal",
        required_delivery_date=date(2026, 6, 18),
        status=ShipmentStatus.SUBMITTED,
        lines=[
            ShipmentLine(
                shipment_id="SHP-2026-0002",
                item_code="AOAC-10/35",
                batch_number="AOAC-B2401",
                warehouse_location="Mumbai WH",
                quantity_requested=30,
                quantity_approved=0,
            )
        ],
    ),
]

DISPATCHES = [
    Dispatch(
        dispatch_number="DSP-2026-0001",
        shipment_id="SHP-2026-0001",
        dispatch_date=date(2026, 6, 8),
        transporter_courier="Blue Dart Aviation",
        tracking_number="176-12345678",
        dispatched_by="Warehouse Executive",
        status="dispatched",
    )
]

GOODS_RECEIPTS = [
    GoodsReceipt(
        grn_number="GRN-2026-0001",
        receipt_date=date(2026, 6, 5),
        warehouse="Mumbai WH",
        supplier="ABC Medical Devices Pvt Ltd",
        status="posted",
        lines=[
            GoodsReceiptLine(
                item_code="MYVAL-THV-26",
                batch_number="B240501",
                quantity_received=25,
                expiry_date=date(2026, 8, 15),
                unit_value=18400.0,
            )
        ],
    )
]

INVENTORY_COUNTS = [
    PhysicalInventoryCount(
        inventory_count_id="CNT-2026-0001",
        count_date=date(2026, 6, 6),
        warehouse="Mumbai WH",
        status="submitted",
        lines=[
            PhysicalInventoryCountLine(
                item_code="AOAC-10/35",
                batch_number="AOAC-B2401",
                system_quantity=120,
                physical_quantity=118,
                variance_quantity=-2,
                variance_type="deficit",
            ),
            PhysicalInventoryCountLine(
                item_code="MYVAL-THV-26",
                batch_number="B240501",
                system_quantity=25,
                physical_quantity=26,
                variance_quantity=1,
                variance_type="excess",
            ),
        ],
    )
]


def _parse_date(value: object) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _raw_batch_from_payload(payload: dict[str, object]) -> dict[str, object]:
    payload["manufacturing_date"] = _parse_date(payload["manufacturing_date"])
    payload["expiry_date"] = _parse_date(payload["expiry_date"])
    return payload


def _load_or_seed(
    collection: str,
    records: list,
    factory,
    key_fn,
) -> None:
    saved_records = load_collection(collection, factory)
    if saved_records:
        records[:] = saved_records
        return
    save_collection(collection, records, key_fn)


def _save_products() -> None:
    save_collection("products", PRODUCTS, lambda product: product.item_code)


def _save_customers() -> None:
    save_collection("customers", CUSTOMERS, lambda customer: customer.customer_code)


def _save_warehouses() -> None:
    save_collection("warehouses", WAREHOUSES, lambda warehouse: warehouse.warehouse_code)


def _save_raw_batches() -> None:
    save_collection(
        "inventory_batches",
        RAW_BATCHES,
        lambda batch: "|".join(
            [
                str(batch["item_code"]),
                str(batch["batch_number"]),
                str(batch["warehouse_location"]),
            ]
        ),
    )


def _save_shipments() -> None:
    save_collection("shipments", SHIPMENTS, lambda shipment: shipment.shipment_id)


def _save_dispatches() -> None:
    save_collection("dispatches", DISPATCHES, lambda dispatch: dispatch.dispatch_number)


def _save_goods_receipts() -> None:
    save_collection("goods_receipts", GOODS_RECEIPTS, lambda receipt: receipt.grn_number)


def _save_inventory_counts() -> None:
    save_collection("inventory_counts", INVENTORY_COUNTS, lambda count: count.inventory_count_id)


def _bootstrap_persistent_state() -> None:
    _load_or_seed("products", PRODUCTS, lambda payload: Product(**payload), lambda product: product.item_code)
    _load_or_seed("customers", CUSTOMERS, lambda payload: Customer(**payload), lambda customer: customer.customer_code)
    _load_or_seed(
        "warehouses",
        WAREHOUSES,
        lambda payload: WarehouseLocation(**payload),
        lambda warehouse: warehouse.warehouse_code,
    )
    _load_or_seed("inventory_batches", RAW_BATCHES, _raw_batch_from_payload, lambda batch: "|".join([
        str(batch["item_code"]),
        str(batch["batch_number"]),
        str(batch["warehouse_location"]),
    ]))
    _load_or_seed("shipments", SHIPMENTS, lambda payload: ShipmentRequest(**payload), lambda shipment: shipment.shipment_id)
    _load_or_seed("dispatches", DISPATCHES, lambda payload: Dispatch(**payload), lambda dispatch: dispatch.dispatch_number)
    _load_or_seed("goods_receipts", GOODS_RECEIPTS, lambda payload: GoodsReceipt(**payload), lambda receipt: receipt.grn_number)
    _load_or_seed(
        "inventory_counts",
        INVENTORY_COUNTS,
        lambda payload: PhysicalInventoryCount(**payload),
        lambda count: count.inventory_count_id,
    )


_bootstrap_persistent_state()


def list_products(search: str | None = None, category: str | None = None) -> list[Product]:
    products = PRODUCTS
    if search:
        search_lower = search.lower()
        products = [
            product
            for product in products
            if search_lower in product.item_code.lower()
            or search_lower in product.product_description.lower()
        ]
    if category:
        products = [
            product
            for product in products
            if product.product_category.lower() == category.lower()
        ]
    return products


def list_customers() -> list[Customer]:
    return CUSTOMERS


def _generate_customer_code(name: str) -> str:
    base = "CUST-" + "".join(ch for ch in name.upper() if ch.isalnum())[:10]
    code = base if base != "CUST-" else "CUST"
    existing = {customer.customer_code for customer in CUSTOMERS}
    if code not in existing:
        return code
    suffix = 2
    while f"{code}-{suffix}" in existing:
        suffix += 1
    return f"{code}-{suffix}"


def create_customer(request: CreateCustomerRequest) -> Customer:
    name = request.customer_name.strip()
    country = request.country.strip()
    if not name:
        raise ValueError("Customer name is mandatory.")
    if not country:
        raise ValueError("Country is mandatory.")
    if any(customer.customer_name.lower() == name.lower() for customer in CUSTOMERS):
        raise ValueError(f"Customer already exists: {name}")
    customer = Customer(
        customer_code=_generate_customer_code(name),
        customer_name=name,
        country=country,
        city=(request.city.strip() if request.city else None) or None,
        customer_type=request.customer_type.strip() or "Customer",
        contact_person=request.contact_person.strip(),
    )
    CUSTOMERS.insert(0, customer)
    _save_customers()
    record_audit_event(
        action="create",
        module_name="customer_master",
        entity_name="customer",
        entity_id=customer.customer_code,
        actor="system_or_api_user",
        new_value=customer,
    )
    return customer


def list_warehouses(country: str | None = None) -> list[WarehouseLocation]:
    if not country:
        return WAREHOUSES
    return [
        warehouse
        for warehouse in WAREHOUSES
        if warehouse.country.lower() == country.lower()
    ]


def get_product(item_code: str) -> Product | None:
    return next((product for product in PRODUCTS if product.item_code == item_code), None)


def create_product(request: CreateProductRequest) -> Product:
    if get_product(request.item_code):
        raise ValueError(f"Item Code already exists: {request.item_code}")

    product = Product(
        item_code=request.item_code,
        product_description=request.product_description,
        product_category=request.product_category,
        uom=request.uom,
        product_status=request.product_status,
        shelf_life_months=request.shelf_life_months,
    )
    PRODUCTS.append(product)
    _save_products()
    record_audit_event(
        action="create",
        module_name="product_master",
        entity_name="product",
        entity_id=product.item_code,
        actor="system_or_api_user",
        new_value=product,
    )
    return product


def get_raw_batch(
    item_code: str,
    batch_number: str,
    warehouse_location: str | None = None,
) -> dict[str, object] | None:
    for raw_batch in RAW_BATCHES:
        if str(raw_batch["item_code"]).lower() != item_code.lower():
            continue
        if str(raw_batch["batch_number"]).lower() != batch_number.lower():
            continue
        if warehouse_location and str(raw_batch["warehouse_location"]).lower() != warehouse_location.lower():
            continue
        return raw_batch
    return None


def _backfill_shipment_line_warehouses() -> None:
    changed = False
    for shipment in SHIPMENTS:
        for line in shipment.lines:
            if line.warehouse_location:
                continue
            raw_batch = get_raw_batch(line.item_code, line.batch_number)
            if not raw_batch:
                continue
            line.warehouse_location = str(raw_batch["warehouse_location"])
            changed = True
    if changed:
        _save_shipments()


_backfill_shipment_line_warehouses()


def get_available_quantity(
    item_code: str,
    batch_number: str,
    warehouse_location: str | None = None,
) -> float:
    raw_batch = get_raw_batch(item_code, batch_number, warehouse_location)
    if raw_batch is None:
        return 0
    return float(raw_batch["quantity_available"])


def increase_inventory(
    item_code: str,
    batch_number: str,
    warehouse_location: str,
    quantity: float,
    expiry_date: date,
    unit_value: float,
    manufacturing_date: date | None = None,
    currency: str | None = None,
) -> None:
    if quantity <= 0:
        raise ValueError("Receipt quantity must be greater than zero")
    if not get_product(item_code):
        raise ValueError(f"Product does not exist: {item_code}")

    raw_batch = get_raw_batch(item_code, batch_number, warehouse_location)
    if raw_batch:
        old_value = dict(raw_batch)
        raw_batch["quantity_available"] = float(raw_batch["quantity_available"]) + quantity
        raw_batch["expiry_date"] = expiry_date
        raw_batch["unit_value"] = unit_value
        if manufacturing_date:
            raw_batch["manufacturing_date"] = manufacturing_date
        if currency:
            raw_batch["currency"] = currency.strip().upper()
        _save_raw_batches()
        record_audit_event(
            action="increase",
            module_name="inventory",
            entity_name="inventory_batch",
            entity_id=f"{item_code}/{batch_number}/{warehouse_location}",
            actor="goods_receipt",
            old_value=old_value,
            new_value=raw_batch,
        )
        return

    new_batch = {
        "item_code": item_code,
        "batch_number": batch_number,
        "warehouse_location": warehouse_location,
        "quantity_available": quantity,
        "manufacturing_date": manufacturing_date or date.today(),
        "expiry_date": expiry_date,
        "unit_value": unit_value,
        "currency": currency.strip().upper() if currency else None,
        "registered_date": date.today().isoformat(),
    }
    RAW_BATCHES.append(new_batch)
    _save_raw_batches()
    record_audit_event(
        action="create",
        module_name="inventory",
        entity_name="inventory_batch",
        entity_id=f"{item_code}/{batch_number}/{warehouse_location}",
        actor="goods_receipt",
        new_value=new_batch,
    )


def decrease_inventory(
    item_code: str,
    batch_number: str,
    quantity: float,
    warehouse_location: str | None = None,
) -> None:
    if quantity <= 0:
        raise ValueError("Dispatch quantity must be greater than zero")

    raw_batch = get_raw_batch(item_code, batch_number, warehouse_location)
    if not raw_batch:
        raise ValueError(f"Inventory batch not found: {item_code} / {batch_number}")

    available = float(raw_batch["quantity_available"])
    if quantity > available:
        raise ValueError(
            f"Cannot dispatch {quantity}. Available stock is {available} for {item_code} / {batch_number}"
        )

    old_value = dict(raw_batch)
    raw_batch["quantity_available"] = available - quantity
    _save_raw_batches()
    record_audit_event(
        action="decrease",
        module_name="inventory",
        entity_name="inventory_batch",
        entity_id=f"{item_code}/{batch_number}/{raw_batch['warehouse_location']}",
        actor="dispatch",
        old_value=old_value,
        new_value=raw_batch,
    )


def list_inventory_batches() -> list[InventoryBatch]:
    batches: list[InventoryBatch] = []
    today = date.today()
    for raw_batch in RAW_BATCHES:
        product = get_product(str(raw_batch["item_code"]))
        quantity = float(raw_batch["quantity_available"])
        unit_value = float(raw_batch["unit_value"])
        expiry_date = _parse_date(raw_batch["expiry_date"])
        manufacturing_date = _parse_date(raw_batch["manufacturing_date"])
        days_to_expiry = (expiry_date - today).days
        batches.append(
            InventoryBatch(
                item_code=product.item_code if product else str(raw_batch["item_code"]),
                product_description=product.product_description if product else "Pending Product Master",
                product_category=product.product_category if product else "Pending Classification",
                batch_number=str(raw_batch["batch_number"]),
                warehouse_location=str(raw_batch["warehouse_location"]),
                quantity_available=quantity,
                manufacturing_date=manufacturing_date,
                expiry_date=expiry_date,
                unit_value=unit_value,
                inventory_value=quantity * unit_value,
                days_to_expiry=days_to_expiry,
                expiry_bucket=get_expiry_bucket(days_to_expiry),
                currency=(str(raw_batch["currency"]).upper() if raw_batch.get("currency") else None),
                registered_date=(
                    _parse_date(raw_batch["registered_date"]) if raw_batch.get("registered_date") else None
                ),
            )
        )
    return batches


def get_expiry_bucket(days_to_expiry: int) -> str:
    if days_to_expiry < 0:
        return "Expired"
    if days_to_expiry <= 90:
        return "0-90 Days"
    if days_to_expiry <= 180:
        return "91-180 Days"
    if days_to_expiry <= 365:
        return "181-365 Days"
    return "Above 365 Days"


def list_fefo_batches(item_code: str) -> list[InventoryBatch]:
    return sorted(
        [batch for batch in list_inventory_batches() if batch.item_code == item_code],
        key=lambda batch: batch.expiry_date,
    )


def create_shipment_request(request: CreateShipmentRequest) -> ShipmentRequest:
    requesting_user = require_user_permission(request.auth_token, "shipment_request")
    if normalize_email(request.requestor_name) != requesting_user.email:
        raise ValueError("Shipment requestor must match the logged-in user.")
    if not request.customer_name.strip():
        raise ValueError("Customer name is mandatory.")
    if not request.destination_country.strip():
        raise ValueError("Destination country is mandatory.")
    if request.priority.lower() not in {"normal", "urgent"}:
        raise ValueError("Priority must be Normal or Urgent.")
    if not request.lines:
        raise ValueError("Shipment must contain at least one line.")

    shipment_id = generate_shipment_id()
    shipment_lines: list[ShipmentLine] = []
    for line in request.lines:
        if line.quantity_requested <= 0:
            raise ValueError(f"Requested quantity must be greater than zero for {line.item_code}.")
        raw_batch = get_raw_batch(
            item_code=line.item_code,
            batch_number=line.batch_number,
            warehouse_location=line.warehouse_location,
        )
        if not raw_batch:
            raise ValueError(
                f"Inventory batch not found in {line.warehouse_location}: {line.item_code} / {line.batch_number}"
            )
        available = float(raw_batch["quantity_available"])
        if line.quantity_requested > available:
            raise ValueError(
                f"Cannot request {line.quantity_requested}. Available stock is {available} for {line.item_code} / {line.batch_number} in {line.warehouse_location}."
            )
        shipment_lines.append(
            ShipmentLine(
                shipment_id=shipment_id,
                item_code=line.item_code,
                batch_number=line.batch_number,
                warehouse_location=line.warehouse_location,
                quantity_requested=line.quantity_requested,
                quantity_approved=0,
            )
        )

    shipment = ShipmentRequest(
        shipment_id=shipment_id,
        request_date=request.request_date,
        requestor_name=requesting_user.email,
        customer_name=request.customer_name.strip(),
        destination_country=request.destination_country.strip(),
        city=(request.city.strip() if request.city else None) or None,
        priority=request.priority.lower(),
        required_delivery_date=request.required_delivery_date,
        status=ShipmentStatus.SUBMITTED if request.submit_for_approval else ShipmentStatus.DRAFT,
        lines=shipment_lines,
    )
    SHIPMENTS.insert(0, shipment)
    _save_shipments()
    record_audit_event(
        action="create",
        module_name="shipment",
        entity_name="shipment_request",
        entity_id=shipment.shipment_id,
        actor=requesting_user.email,
        new_value=shipment,
    )
    return shipment


def generate_shipment_id() -> str:
    year = date.today().year
    prefix = f"SHP-{year}-"
    next_number = 1
    for shipment in SHIPMENTS:
        if not shipment.shipment_id.startswith(prefix):
            continue
        try:
            next_number = max(next_number, int(shipment.shipment_id.removeprefix(prefix)) + 1)
        except ValueError:
            continue
    return f"{prefix}{next_number:04d}"


def list_shipments() -> list[ShipmentRequest]:
    return SHIPMENTS


def list_dispatches() -> list[Dispatch]:
    return DISPATCHES


def list_goods_receipts() -> list[GoodsReceipt]:
    return GOODS_RECEIPTS


def post_goods_receipt(request: CreateGoodsReceiptRequest) -> WorkflowResult:
    if any(receipt.grn_number == request.grn_number for receipt in GOODS_RECEIPTS):
        raise ValueError(f"GRN Number already exists: {request.grn_number}")
    if not request.lines:
        raise ValueError("Goods receipt must contain at least one line")

    receipt = GoodsReceipt(
        grn_number=request.grn_number,
        receipt_date=request.receipt_date,
        warehouse=request.warehouse,
        supplier=request.supplier,
        status="posted",
        lines=[
            GoodsReceiptLine(
                item_code=line.item_code,
                batch_number=line.batch_number,
                quantity_received=line.quantity_received,
                expiry_date=line.expiry_date,
                unit_value=line.unit_value,
                currency=line.currency,
            )
            for line in request.lines
        ],
    )

    for line in request.lines:
        increase_inventory(
            item_code=line.item_code,
            batch_number=line.batch_number,
            warehouse_location=request.warehouse,
            quantity=line.quantity_received,
            manufacturing_date=line.manufacturing_date,
            expiry_date=line.expiry_date,
            unit_value=line.unit_value,
            currency=line.currency,
        )

    GOODS_RECEIPTS.append(receipt)
    _save_goods_receipts()
    record_audit_event(
        action="post",
        module_name="goods_receipt",
        entity_name="grn",
        entity_id=receipt.grn_number,
        actor="system_or_api_user",
        new_value=receipt,
    )
    return WorkflowResult(
        status="posted",
        message="Goods receipt posted and inventory increased.",
        data={"grn_number": receipt.grn_number, "line_count": len(receipt.lines)},
    )


def get_shipment(shipment_id: str) -> ShipmentRequest | None:
    return next((shipment for shipment in SHIPMENTS if shipment.shipment_id == shipment_id), None)


def approve_shipment(shipment_id: str, request: ShipmentApprovalRequest) -> WorkflowResult:
    approving_user = require_user_permission(request.auth_token, "shipment_approval")
    shipment = get_shipment(shipment_id)
    if not shipment:
        raise ValueError(f"Shipment not found: {shipment_id}")
    if shipment.status not in {ShipmentStatus.SUBMITTED, ShipmentStatus.DRAFT}:
        raise ValueError(f"Shipment cannot be approved from status: {shipment.status.value}")
    if not request.lines:
        raise ValueError("Approval must contain at least one line")
    if normalize_email(request.approved_by) != approving_user.email:
        raise ValueError("Shipment approval must match the logged-in user.")
    ensure_country_scope(approving_user, shipment.destination_country, "approve shipments")

    approval_by_key = {
        (
            line.item_code.lower(),
            line.batch_number.lower(),
            (line.warehouse_location or "").lower(),
        ): line
        for line in request.lines
    }

    for shipment_line in shipment.lines:
        approval_line = approval_by_key.get(
            (
                shipment_line.item_code.lower(),
                shipment_line.batch_number.lower(),
                (shipment_line.warehouse_location or "").lower(),
            )
        )
        if not approval_line:
            raise ValueError(
                f"Approval missing for {shipment_line.item_code} / {shipment_line.batch_number} / {shipment_line.warehouse_location or 'warehouse not set'}"
            )
        if approval_line.quantity_approved > shipment_line.quantity_requested:
            raise ValueError(
                f"Approved quantity cannot exceed requested quantity for {shipment_line.item_code}"
            )
        if approval_line.quantity_approved <= 0:
            raise ValueError(f"Approved quantity must be greater than zero for {shipment_line.item_code}")
        available = get_available_quantity(
            item_code=shipment_line.item_code,
            batch_number=shipment_line.batch_number,
            warehouse_location=shipment_line.warehouse_location,
        )
        if approval_line.quantity_approved > available:
            raise ValueError(
                f"Cannot approve {approval_line.quantity_approved}. Available stock is {available} for {shipment_line.item_code} / {shipment_line.batch_number} in {shipment_line.warehouse_location or 'selected warehouse'}"
            )

    for shipment_line in shipment.lines:
        approval_line = approval_by_key[
            (
                shipment_line.item_code.lower(),
                shipment_line.batch_number.lower(),
                (shipment_line.warehouse_location or "").lower(),
            )
        ]
        shipment_line.quantity_approved = approval_line.quantity_approved

    shipment.status = ShipmentStatus.APPROVED
    _save_shipments()
    record_audit_event(
        action="approve",
        module_name="shipment",
        entity_name="shipment_request",
        entity_id=shipment_id,
        actor=approving_user.email,
        new_value=shipment,
    )
    return WorkflowResult(
        status="approved",
        message="Shipment approved. Stock is available for dispatch.",
        data={"shipment_id": shipment_id, "approved_by": approving_user.email},
    )


def confirm_dispatch(shipment_id: str, request: CreateDispatchRequest) -> WorkflowResult:
    dispatching_user = require_user_permission(request.auth_token, "dispatch")
    shipment = get_shipment(shipment_id)
    if not shipment:
        raise ValueError(f"Shipment not found: {shipment_id}")
    if shipment.status != ShipmentStatus.APPROVED:
        raise ValueError(f"Shipment must be approved before dispatch. Current status: {shipment.status.value}")
    if any(dispatch.dispatch_number == request.dispatch_number for dispatch in DISPATCHES):
        raise ValueError(f"Dispatch Number already exists: {request.dispatch_number}")
    if normalize_email(request.dispatched_by) != dispatching_user.email:
        raise ValueError("Dispatch user must match the logged-in user.")

    for shipment_line in shipment.lines:
        if shipment_line.quantity_approved <= 0:
            raise ValueError(f"Approved quantity is missing for {shipment_line.item_code} / {shipment_line.batch_number}")
        if not shipment_line.warehouse_location:
            raise ValueError(f"Warehouse location is missing for {shipment_line.item_code} / {shipment_line.batch_number}")
        decrease_inventory(
            item_code=shipment_line.item_code,
            batch_number=shipment_line.batch_number,
            quantity=shipment_line.quantity_approved,
            warehouse_location=shipment_line.warehouse_location,
        )

    dispatch = Dispatch(
        dispatch_number=request.dispatch_number,
        shipment_id=shipment_id,
        dispatch_date=request.dispatch_date,
        transporter_courier=request.transporter_courier,
        tracking_number=request.tracking_number,
        dispatched_by=dispatching_user.email,
        status="dispatched",
    )
    DISPATCHES.append(dispatch)
    shipment.status = ShipmentStatus.DISPATCHED
    _save_dispatches()
    _save_shipments()
    record_audit_event(
        action="dispatch",
        module_name="shipment",
        entity_name="shipment_request",
        entity_id=shipment_id,
        actor=dispatching_user.email,
        new_value={"shipment": shipment, "dispatch": dispatch},
    )

    return WorkflowResult(
        status="dispatched",
        message="Dispatch confirmed and inventory reduced.",
        data={"shipment_id": shipment_id, "dispatch_number": request.dispatch_number},
    )


def list_inventory_counts() -> list[PhysicalInventoryCount]:
    return INVENTORY_COUNTS


def create_inventory_count(request: CreateInventoryCountRequest) -> PhysicalInventoryCount:
    if any(count.inventory_count_id == request.inventory_count_id for count in INVENTORY_COUNTS):
        raise ValueError(f"Inventory Count ID already exists: {request.inventory_count_id}")
    if not request.lines:
        raise ValueError("Inventory count must contain at least one line")

    count = PhysicalInventoryCount(
        inventory_count_id=request.inventory_count_id,
        count_date=request.count_date,
        warehouse=request.warehouse,
        status="submitted",
        lines=[
            PhysicalInventoryCountLine(
                item_code=line.item_code,
                batch_number=line.batch_number,
                system_quantity=line.system_quantity,
                physical_quantity=line.physical_quantity,
                variance_quantity=line.physical_quantity - line.system_quantity,
                variance_type=get_variance_type(line.physical_quantity - line.system_quantity),
            )
            for line in request.lines
        ],
    )
    INVENTORY_COUNTS.append(count)
    _save_inventory_counts()
    record_audit_event(
        action="create",
        module_name="inventory_count",
        entity_name="physical_inventory_count",
        entity_id=count.inventory_count_id,
        actor=request.counted_by,
        new_value=count,
    )
    return count


def get_variance_type(variance_quantity: float) -> str:
    if variance_quantity > 0:
        return "excess"
    if variance_quantity < 0:
        return "deficit"
    return "matched"


def list_expiry_alerts(days: int = 180) -> list[InventoryBatch]:
    return [
        batch
        for batch in list_inventory_batches()
        if 0 <= batch.days_to_expiry <= days
    ]


def dashboard_summary() -> DashboardSummary:
    batches = list_inventory_batches()
    inventory_by_warehouse: dict[str, float] = {}
    inventory_by_category: dict[str, float] = {}
    today = date.today()

    for batch in batches:
        inventory_by_warehouse[batch.warehouse_location] = (
            inventory_by_warehouse.get(batch.warehouse_location, 0) + batch.inventory_value
        )
        inventory_by_category[batch.product_category] = (
            inventory_by_category.get(batch.product_category, 0) + batch.inventory_value
        )

    variance_summary = {"excess": 0.0, "deficit": 0.0}
    for inventory_count in INVENTORY_COUNTS:
        for line in inventory_count.lines:
            if line.variance_quantity > 0:
                variance_summary["excess"] += line.variance_quantity
            if line.variance_quantity < 0:
                variance_summary["deficit"] += abs(line.variance_quantity)

    return DashboardSummary(
        total_inventory_value=sum(batch.inventory_value for batch in batches),
        total_inventory_quantity=sum(batch.quantity_available for batch in batches),
        inventory_by_warehouse=inventory_by_warehouse,
        inventory_by_category=inventory_by_category,
        expiring_stock_alerts=len(list_expiry_alerts(180)),
        expiring_in_30_days=len(
            [batch for batch in batches if 0 <= batch.days_to_expiry <= 30]
        ),
        expiring_in_60_days=len(
            [batch for batch in batches if 0 <= batch.days_to_expiry <= 60]
        ),
        expiring_in_90_days=len(
            [batch for batch in batches if 0 <= batch.days_to_expiry <= 90]
        ),
        expired_inventory_count=len(
            [batch for batch in batches if batch.days_to_expiry < 0]
        ),
        open_shipment_requests=len(
            [
                shipment
                for shipment in SHIPMENTS
                if shipment.status in {ShipmentStatus.DRAFT, ShipmentStatus.SUBMITTED, ShipmentStatus.APPROVED}
            ]
        ),
        dispatched_shipments=len(DISPATCHES),
        goods_received_today=len(
            [receipt for receipt in GOODS_RECEIPTS if receipt.receipt_date == today]
        ),
        inventory_variance_summary=variance_summary,
        top_customers=[
            {"customer_name": "Apollo Hospital", "shipments": 1},
            {"customer_name": "Dubai Health Authority", "shipments": 1},
        ],
    )


def answer_assistant_question(question: str) -> AssistantAnswer:
    question_lower = question.lower()

    if "expiring" in question_lower or "expiry" in question_lower:
        data = [batch.model_dump(mode="json") for batch in list_expiry_alerts(180)]
        return AssistantAnswer(
            question=question,
            answer=f"Found {len(data)} batches expiring within 180 days.",
            data=data,
        )

    if "pending dispatch" in question_lower or "pending" in question_lower:
        pending = [
            shipment
            for shipment in SHIPMENTS
            if shipment.status in {ShipmentStatus.SUBMITTED, ShipmentStatus.APPROVED}
        ]
        data = [shipment.model_dump(mode="json") for shipment in pending]
        return AssistantAnswer(
            question=question,
            answer=f"Found {len(data)} shipments pending dispatch.",
            data=data,
        )

    if "stock" in question_lower:
        data = [batch.model_dump(mode="json") for batch in list_inventory_batches()]
        return AssistantAnswer(
            question=question,
            answer="Current stock is shown by item code, batch, and warehouse.",
            data=data,
        )

    if "value by warehouse" in question_lower:
        summary = dashboard_summary()
        data = [
            {"warehouse": warehouse, "inventory_value": value}
            for warehouse, value in summary.inventory_by_warehouse.items()
        ]
        return AssistantAnswer(
            question=question,
            answer="Inventory value by warehouse is ready.",
            data=data,
        )

    if "variance" in question_lower:
        data = [
            line.model_dump(mode="json")
            for count in INVENTORY_COUNTS
            for line in count.lines
        ]
        return AssistantAnswer(
            question=question,
            answer="Stock variance report is ready.",
            data=data,
        )

    return AssistantAnswer(
        question=question,
        answer="I can answer inventory, expiry, shipment, warehouse value, batch traceability, and variance questions.",
        data=[],
    )
