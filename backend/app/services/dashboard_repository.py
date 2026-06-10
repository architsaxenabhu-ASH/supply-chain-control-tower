"""Dashboard data layer.

Read-only aggregations that give each dashboard every metric it needs from the
data the platform already holds. The UI stays simple; the metrics live here.
"""

from __future__ import annotations

from collections import Counter

from app.db.local_persistence import list_audit_events
from app.schemas.dashboards import (
    ExecutiveDashboard,
    ExpiryDashboard,
    ExpiryRiskBatch,
    ImportDashboard,
    InventoryDashboard,
    ShipmentDashboard,
)
from app.services.import_repository import list_import_candidates
from app.services.learning_repository import get_learning_insights
from app.services.warehouse_repository import (
    list_dispatches,
    list_inventory_batches,
    list_shipments,
)

OPEN_IMPORT_STATUSES = {
    "documents_pending",
    "uploaded",
    "extracted",
    "validation_pending",
    "validated",
    "country_documents_pending",
    "customs_in_progress",
    "in_transit",
    "arrived",
    "goods_receipt_pending",
}
IN_TRANSIT_STATUSES = {"validated", "in_transit", "customs_in_progress", "country_documents_pending"}


def executive_dashboard() -> ExecutiveDashboard:
    batches = list_inventory_batches()
    imports = list_import_candidates()
    shipments = list_shipments()
    insights = get_learning_insights()

    return ExecutiveDashboard(
        total_inventory_value=sum(batch.inventory_value for batch in batches),
        total_inventory_quantity=sum(batch.quantity_available for batch in batches),
        open_import_shipments=sum(1 for c in imports if c.status.value in OPEN_IMPORT_STATUSES),
        imports_in_transit=sum(1 for c in imports if c.status.value in IN_TRANSIT_STATUSES),
        imports_awaiting_receipt=sum(1 for c in imports if c.status.value == "arrived"),
        imports_received=sum(1 for c in imports if c.status.value == "received"),
        open_shipment_requests=sum(1 for s in shipments if s.status.value in {"draft", "submitted", "approved"}),
        dispatched_shipments=sum(1 for s in shipments if s.status.value == "dispatched"),
        delivered_shipments=sum(1 for s in shipments if s.status.value == "delivered"),
        expiry_risk_90=sum(1 for batch in batches if 0 <= batch.days_to_expiry <= 90),
        expired_inventory=sum(1 for batch in batches if batch.days_to_expiry < 0),
        active_warehouses=len({batch.warehouse_location for batch in batches if batch.warehouse_location}),
        active_countries=len({c.destination_country for c in imports if c.destination_country}),
        learning_rules=insights.total_learning_rules,
        audit_events=len(list_audit_events(limit=500)),
    )


def inventory_dashboard() -> InventoryDashboard:
    batches = list_inventory_batches()
    by_warehouse: dict[str, float] = {}
    by_category: dict[str, float] = {}
    for batch in batches:
        by_warehouse[batch.warehouse_location] = by_warehouse.get(batch.warehouse_location, 0) + batch.inventory_value
        by_category[batch.product_category] = by_category.get(batch.product_category, 0) + batch.inventory_value

    return InventoryDashboard(
        total_value=sum(batch.inventory_value for batch in batches),
        total_quantity=sum(batch.quantity_available for batch in batches),
        batch_count=len(batches),
        by_warehouse_value=by_warehouse,
        by_category_value=by_category,
        expiring_30=sum(1 for batch in batches if 0 <= batch.days_to_expiry <= 30),
        expiring_60=sum(1 for batch in batches if 0 <= batch.days_to_expiry <= 60),
        expiring_90=sum(1 for batch in batches if 0 <= batch.days_to_expiry <= 90),
        expired=sum(1 for batch in batches if batch.days_to_expiry < 0),
    )


def import_dashboard() -> ImportDashboard:
    imports = list_import_candidates()
    by_status = Counter(c.status.value for c in imports)
    by_country = Counter(c.destination_country for c in imports if c.destination_country)
    return ImportDashboard(
        total=len(imports),
        by_status=dict(by_status),
        open_shipments=sum(1 for c in imports if c.status.value in OPEN_IMPORT_STATUSES),
        awaiting_receipt=sum(1 for c in imports if c.status.value == "arrived"),
        received=sum(1 for c in imports if c.status.value == "received"),
        by_country=dict(by_country),
    )


def expiry_dashboard() -> ExpiryDashboard:
    batches = list_inventory_batches()
    at_risk_90 = [batch for batch in batches if 0 <= batch.days_to_expiry <= 90]
    by_warehouse_90 = Counter(batch.warehouse_location for batch in at_risk_90 if batch.warehouse_location)
    soonest = sorted(
        (batch for batch in batches if batch.days_to_expiry >= 0),
        key=lambda batch: batch.days_to_expiry,
    )[:10]

    return ExpiryDashboard(
        expiring_30=sum(1 for batch in batches if 0 <= batch.days_to_expiry <= 30),
        expiring_60=sum(1 for batch in batches if 0 <= batch.days_to_expiry <= 60),
        expiring_90=len(at_risk_90),
        expiring_180=sum(1 for batch in batches if 0 <= batch.days_to_expiry <= 180),
        expired=sum(1 for batch in batches if batch.days_to_expiry < 0),
        value_at_risk_90=sum(batch.inventory_value for batch in at_risk_90),
        by_warehouse_90=dict(by_warehouse_90),
        soonest=[
            ExpiryRiskBatch(
                item_code=batch.item_code,
                batch_number=batch.batch_number,
                warehouse=batch.warehouse_location,
                expiry_date=batch.expiry_date.isoformat(),
                days_to_expiry=batch.days_to_expiry,
                quantity=batch.quantity_available,
                value=batch.inventory_value,
            )
            for batch in soonest
        ],
    )


def shipment_dashboard() -> ShipmentDashboard:
    shipments = list_shipments()
    dispatches = list_dispatches()
    by_status = Counter(s.status.value for s in shipments)
    by_country = Counter(s.destination_country for s in shipments if s.destination_country)
    return ShipmentDashboard(
        total=len(shipments),
        by_status=dict(by_status),
        dispatched=len(dispatches),
        delivered=sum(1 for s in shipments if s.status.value == "delivered"),
        by_country=dict(by_country),
    )
