"""Review Intelligence (Phase 4, P6).

Transaction-driven management reviews: every review returns summary KPIs AND the
underlying source transactions so management reviews transactions, not just
dashboards. Pure composition over existing engines.
"""

from __future__ import annotations

from app.schemas.review import ReviewItem, ReviewResponse
from app.services.commercial_performance import performance
from app.services.commitment_repository import list_commitments
from app.services.distribution_intelligence import country_intelligence, distributor_intelligence
from app.services.receivables_repository import list_receivables
from app.services.warehouse_repository import list_inventory_batches

EXPIRY_REVIEW_DAYS = 365


def inventory_review() -> ReviewResponse:
    batches = list_inventory_batches()
    items = [
        ReviewItem(
            reference=batch.batch_number,
            source="inventory_batch",
            detail={
                "item_code": batch.item_code,
                "warehouse": batch.warehouse_location,
                "quantity": batch.quantity_available,
                "unit_value": batch.unit_value,
                "inventory_value": batch.inventory_value,
                "expiry_date": batch.expiry_date.isoformat(),
                "days_to_expiry": batch.days_to_expiry,
            },
        )
        for batch in batches
    ]
    return ReviewResponse(
        review_type="inventory",
        summary={
            "total_value": round(sum(b.inventory_value for b in batches), 2),
            "total_quantity": sum(b.quantity_available for b in batches),
            "batch_count": len(batches),
            "expiring_within_90_days": sum(1 for b in batches if 0 <= b.days_to_expiry <= 90),
        },
        items=items,
    )


def expiry_review() -> ReviewResponse:
    batches = sorted(
        (b for b in list_inventory_batches() if b.days_to_expiry < EXPIRY_REVIEW_DAYS),
        key=lambda b: b.days_to_expiry,
    )
    items = [
        ReviewItem(
            reference=batch.batch_number,
            source="inventory_batch",
            detail={
                "item_code": batch.item_code,
                "warehouse": batch.warehouse_location,
                "quantity": batch.quantity_available,
                "inventory_value": batch.inventory_value,
                "expiry_date": batch.expiry_date.isoformat(),
                "days_to_expiry": batch.days_to_expiry,
            },
        )
        for batch in batches
    ]
    return ReviewResponse(
        review_type="expiry",
        summary={
            "expired": sum(1 for b in batches if b.days_to_expiry < 0),
            "expiring_within_90_days": sum(1 for b in batches if 0 <= b.days_to_expiry <= 90),
            "expiring_within_180_days": sum(1 for b in batches if 0 <= b.days_to_expiry <= 180),
            "value_at_risk": round(sum(b.inventory_value for b in batches if b.days_to_expiry < 182), 2),
        },
        items=items,
    )


def open_orders_review() -> ReviewResponse:
    commitments = [c for c in list_commitments() if c.status != "fulfilled"]
    items = [
        ReviewItem(
            reference=commitment.commitment_id,
            source="customer_commitment",
            detail={
                "po_number": commitment.po_number,
                "customer": commitment.customer,
                "material": commitment.material,
                "ordered": commitment.ordered_quantity,
                "delivered": commitment.delivered_quantity,
                "backorder": commitment.backorder_quantity,
                "required_delivery_date": commitment.required_delivery_date,
                "status": commitment.status,
            },
        )
        for commitment in commitments
    ]
    return ReviewResponse(
        review_type="open_orders",
        summary={
            "open_orders": len(commitments),
            "delayed": sum(1 for c in commitments if c.status == "delayed"),
            "backordered": sum(1 for c in commitments if c.status == "backordered"),
            "backorder_quantity": sum(c.backorder_quantity for c in commitments),
        },
        items=items,
    )


def receivables_review() -> ReviewResponse:
    receivables = [r for r in list_receivables() if r.status != "paid"]
    items = [
        ReviewItem(
            reference=receivable.receivable_id,
            source="receivable",
            detail={
                "distributor": receivable.distributor,
                "invoice_number": receivable.invoice_number,
                "invoice_date": receivable.invoice_date,
                "due_date": receivable.due_date,
                "invoice_value": receivable.invoice_value,
                "outstanding_value": receivable.outstanding_value,
                "status": receivable.status,
            },
        )
        for receivable in receivables
    ]
    return ReviewResponse(
        review_type="receivables",
        summary={
            "outstanding": round(sum(r.outstanding_value for r in receivables), 2),
            "past_due": round(sum(r.outstanding_value for r in receivables if r.status == "overdue"), 2),
            "open_invoices": len(receivables),
        },
        items=items,
    )


def distributor_review() -> ReviewResponse:
    cards = distributor_intelligence()
    items = [
        ReviewItem(
            reference=card.distributor,
            source="distributor_intelligence",
            detail=card.model_dump(),
        )
        for card in cards
    ]
    return ReviewResponse(
        review_type="distributor",
        summary={
            "distributors": len(cards),
            "total_allocated": sum(c.inventory_allocated for c in cards),
            "total_consumed": sum(c.inventory_consumed for c in cards),
        },
        items=items,
    )


def country_review() -> ReviewResponse:
    cards = country_intelligence()
    items = [
        ReviewItem(reference=card.country, source="country_intelligence", detail=card.model_dump())
        for card in cards
    ]
    return ReviewResponse(
        review_type="country",
        summary={
            "countries": len(cards),
            "total_inventory_value": round(sum(c.inventory_value for c in cards), 2),
            "total_expiry_risk_batches": sum(c.expiry_risk_batches for c in cards),
        },
        items=items,
    )


def vertical_review() -> ReviewResponse:
    cards = performance("vertical")
    items = [
        ReviewItem(reference=card.name, source="vertical_performance", detail=card.model_dump())
        for card in cards
    ]
    return ReviewResponse(
        review_type="vertical",
        summary={
            "verticals": len(cards),
            "total_actual_value": round(sum(c.actual_value for c in cards), 2),
        },
        items=items,
    )
