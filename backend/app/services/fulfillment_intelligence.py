"""Order fulfillment intelligence (Phase 3B): commercial readiness (P4), order
fulfillment workflow (P5), and allocation priority recommendations (P6).

Orders are existing shipments (the fulfillment vehicle) - no new order model.
Composes inventory availability, release status, and credit/payment status.
"""

from __future__ import annotations

from datetime import date

from app.schemas.fulfillment import AllocationPriority, CommercialReadiness, OrderFulfillment
from app.services.demand_intelligence import _allocated_by_product, _inventory_by_product, _reserved_by_product
from app.services.financial_intelligence import credit_status_for
from app.services.release_repository import get_release
from app.services.warehouse_repository import list_shipments

OPEN_SHIPMENT_STATUSES = {"draft", "submitted", "approved"}
EMERGENCY_PRIORITIES = {"emergency", "urgent", "critical"}


def _available_by_product() -> dict[str, float]:
    inventory = _inventory_by_product()
    reserved = _reserved_by_product()
    allocated = _allocated_by_product()
    return {
        item: max(inventory.get(item, 0) - reserved.get(item, 0) - allocated.get(item, 0), 0)
        for item in inventory
    }


def _checks(shipment, available) -> dict:
    status_value = shipment.status.value
    customer_po = status_value != "draft"  # a formalised order beyond draft
    sales_order = True  # the shipment record is the sales order
    credit = credit_status_for(shipment.customer_name)
    payment_ok = not (credit and credit.status == "blocked")

    inventory_available = all(
        available.get(line.item_code, 0) >= line.quantity_requested for line in shipment.lines
    ) if shipment.lines else False

    inventory_released = bool(shipment.lines) and all(
        (lambda r: r is not None and r.sellable)(get_release(line.item_code, line.batch_number))
        for line in shipment.lines
    )

    shipment_ready = status_value in {"approved", "dispatched", "delivered"}
    return {
        "customer_po": customer_po,
        "sales_order": sales_order,
        "payment_ok": payment_ok,
        "inventory_available": inventory_available,
        "inventory_released": inventory_released,
        "shipment_ready": shipment_ready,
        "payment_terms": (None if credit is None else f"limit {credit.credit_limit:g}, exposure {credit.outstanding_exposure:g}"),
        "credit_blocked": bool(credit and credit.status == "blocked"),
    }


def commercial_readiness() -> list[CommercialReadiness]:
    available = _available_by_product()
    results: list[CommercialReadiness] = []
    for shipment in list_shipments():
        checks = _checks(shipment, available)
        if shipment.status.value == "cancelled":
            status, reason = "Blocked", "Shipment cancelled"
        elif not checks["payment_ok"]:
            status, reason = "Waiting Payment", "Customer credit is blocked"
        elif not checks["inventory_available"]:
            status, reason = "Waiting Inventory", "Insufficient available inventory for one or more lines"
        elif not checks["inventory_released"]:
            status, reason = "Waiting Release", "One or more batches not released for sale"
        elif not checks["shipment_ready"]:
            status, reason = "Waiting Shipment", "Shipment not yet approved"
        else:
            status, reason = "Ready", None
        results.append(
            CommercialReadiness(
                shipment_id=shipment.shipment_id,
                customer=shipment.customer_name,
                country=shipment.destination_country,
                status=status,
                customer_po=checks["customer_po"],
                sales_order=checks["sales_order"],
                payment_terms=checks["payment_terms"],
                payment_ok=checks["payment_ok"],
                inventory_available=checks["inventory_available"],
                inventory_released=checks["inventory_released"],
                shipment_ready=checks["shipment_ready"],
                blocking_reason=reason,
            )
        )
    return results


_FULFILLMENT_STAGES = ["Customer PO", "Sales Order", "Payment Check", "Inventory Allocation", "Shipment", "Delivery"]


def order_fulfillment() -> list[OrderFulfillment]:
    available = _available_by_product()
    results: list[OrderFulfillment] = []
    for shipment in list_shipments():
        checks = _checks(shipment, available)
        status_value = shipment.status.value
        stages = {
            "Customer PO": checks["customer_po"],
            "Sales Order": checks["sales_order"],
            "Payment Check": checks["payment_ok"],
            "Inventory Allocation": checks["inventory_available"] and checks["inventory_released"],
            "Shipment": status_value in {"dispatched", "delivered"},
            "Delivery": status_value == "delivered",
        }
        done = sum(1 for v in stages.values() if v)
        next_stage = next((stage for stage in _FULFILLMENT_STAGES if not stages[stage]), None)
        if next_stage is None:
            fulfillment_status, blocking, next_action = "Fulfilled", None, "Complete"
        else:
            fulfillment_status = f"At {next_stage}"
            next_action = {
                "Customer PO": "Capture / confirm the customer PO",
                "Sales Order": "Create the sales order",
                "Payment Check": "Clear the customer's payment / credit hold",
                "Inventory Allocation": "Make inventory available and release the batch",
                "Shipment": "Approve and dispatch the shipment",
                "Delivery": "Confirm customer delivery",
            }[next_stage]
            blocking = None if next_stage in {"Shipment", "Delivery"} else next_action
        results.append(
            OrderFulfillment(
                shipment_id=shipment.shipment_id,
                customer=shipment.customer_name,
                fulfillment_status=fulfillment_status,
                blocking_reason=blocking,
                fulfillment_readiness_pct=round(done / len(_FULFILLMENT_STAGES) * 100),
                expected_next_action=next_action,
                stages=stages,
            )
        )
    return results


def allocation_priority() -> list[AllocationPriority]:
    """Business-rule priority for which open orders should receive inventory first.
    Recommendations only - never auto-allocates."""
    candidates = []
    for shipment in list_shipments():
        if shipment.status.value not in OPEN_SHIPMENT_STATUSES:
            continue
        credit = credit_status_for(shipment.customer_name)
        payment_received = credit is not None and credit.outstanding_exposure <= 0

        if shipment.priority.lower() in EMERGENCY_PRIORITIES:
            tier, reason = 1, "Emergency shipment"
        elif payment_received:
            tier, reason = 2, "Advance payment received"
        else:
            tier, reason = 3, "Oldest commitment"  # ranked by request date below
        candidates.append((tier, shipment, reason))

    # Tier 3 vs 4: the oldest open commitments are tier 3; the rest standard (tier 4).
    tier3 = sorted([c for c in candidates if c[0] == 3], key=lambda c: c[1].request_date)
    for index, (_, shipment, _) in enumerate(tier3):
        if index >= max(1, len(tier3) // 2):
            # newer half are standard allocation
            for i, c in enumerate(candidates):
                if c[1].shipment_id == shipment.shipment_id:
                    candidates[i] = (4, shipment, "Standard allocation")

    ordered = sorted(candidates, key=lambda c: (c[0], c[1].request_date))
    return [
        AllocationPriority(
            rank=rank,
            priority_tier=tier,
            reference=shipment.shipment_id,
            customer=shipment.customer_name,
            country=shipment.destination_country,
            reason=reason,
            required_date=shipment.required_delivery_date.isoformat(),
        )
        for rank, (tier, shipment, reason) in enumerate(ordered, start=1)
    ]
