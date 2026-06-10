"""Business intelligence (Phase 2A): supplier, carrier, customer, and document
performance metrics, plus knowledge-relationship traversal. All rules-based and
derived from existing data - no AI, no forecasting. The point is to build the
calculation framework and capture the relationships future engines will need.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.business_intelligence import (
    CarrierIntelligence,
    CustomerIntelligence,
    DocumentIntelligence,
    ProductMixEntry,
    RelationshipMap,
    RelationshipNode,
    SupplierIntelligence,
)
from app.services.import_repository import get_shipment_timeline, list_import_candidates
from app.services.learning_repository import list_document_templates, list_field_mapping_history
from app.services.local_document_store import list_saved_documents
from app.services.warehouse_repository import (
    list_dispatches,
    list_goods_receipts,
    list_inventory_batches,
    list_shipments,
)


def _candidate_document_ids(candidate) -> set[str]:
    ids = {
        *candidate.source_document_ids,
        *candidate.commercial_invoice_document_ids,
        *candidate.packing_list_document_ids,
    }
    if candidate.awb_document_id:
        ids.add(candidate.awb_document_id)
    return {doc_id for doc_id in ids if doc_id}


def _dedupe(nodes: list[RelationshipNode]) -> list[RelationshipNode]:
    seen: set[tuple[str, str]] = set()
    unique: list[RelationshipNode] = []
    for node in nodes:
        key = (node.entity_type, node.id)
        if key not in seen:
            seen.add(key)
            unique.append(node)
    return unique


def _document_type(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


# --- Supplier intelligence (P2) ------------------------------------------

def supplier_intelligence() -> list[SupplierIntelligence]:
    candidates = list_import_candidates()
    receipts = {receipt.grn_number: receipt for receipt in list_goods_receipts()}
    documents = {doc.document_id: doc for doc in list_saved_documents()}

    by_supplier: dict[str, list] = defaultdict(list)
    for candidate in candidates:
        if candidate.supplier_name:
            by_supplier[candidate.supplier_name].append(candidate)

    result: list[SupplierIntelligence] = []
    for supplier, items in sorted(by_supplier.items()):
        on_time = late = 0
        lead_times: list[int] = []
        completeness: list[float] = []
        for candidate in items:
            timeline = get_shipment_timeline(candidate.import_file_number)
            on_time += timeline.on_time_count
            late += timeline.late_count
            receipt = receipts.get(f"GRN-{candidate.import_file_number}")
            if candidate.flight_date and receipt:
                lead_times.append((receipt.receipt_date - candidate.flight_date).days)
            for doc_id in _candidate_document_ids(candidate):
                doc = documents.get(doc_id)
                if doc and doc.required_field_count > 0:
                    completeness.append((doc.required_field_count - doc.missing_required_count) / doc.required_field_count)
        decided = on_time + late
        result.append(
            SupplierIntelligence(
                supplier=supplier,
                shipment_count=len(items),
                on_time_pct=round(on_time / decided * 100, 1) if decided else None,
                average_lead_time_days=round(sum(lead_times) / len(lead_times), 1) if lead_times else None,
                delay_count=late,
                document_accuracy_pct=round(sum(completeness) / len(completeness) * 100, 1) if completeness else None,
            )
        )
    return result


# --- Carrier intelligence (P3) -------------------------------------------

def carrier_intelligence() -> list[CarrierIntelligence]:
    candidates = list_import_candidates()
    receipts = {receipt.grn_number: receipt for receipt in list_goods_receipts()}

    by_carrier: dict[str, list] = defaultdict(list)
    for candidate in candidates:
        if candidate.carrier_name:
            by_carrier[candidate.carrier_name].append(candidate)

    result: list[CarrierIntelligence] = []
    for carrier, items in sorted(by_carrier.items()):
        transit: list[int] = []
        delays: list[int] = []
        on_time = late = 0
        for candidate in items:
            receipt = receipts.get(f"GRN-{candidate.import_file_number}")
            if candidate.flight_date and receipt:
                transit.append((receipt.receipt_date - candidate.flight_date).days)
            timeline = get_shipment_timeline(candidate.import_file_number)
            on_time += timeline.on_time_count
            late += timeline.late_count
            for milestone in timeline.milestones:
                if milestone.status == "late" and milestone.planned_date and milestone.actual_date:
                    delays.append((date.fromisoformat(milestone.actual_date) - date.fromisoformat(milestone.planned_date)).days)
        decided = on_time + late
        result.append(
            CarrierIntelligence(
                carrier=carrier,
                shipment_count=len(items),
                average_transit_days=round(sum(transit) / len(transit), 1) if transit else None,
                delay_days=round(sum(delays) / len(delays), 1) if delays else None,
                on_time_pct=round(on_time / decided * 100, 1) if decided else None,
            )
        )
    return result


# --- Customer intelligence (P4) ------------------------------------------

def customer_intelligence() -> list[CustomerIntelligence]:
    shipments = list_shipments()
    dispatches = {dispatch.shipment_id: dispatch for dispatch in list_dispatches()}

    by_customer: dict[str, list] = defaultdict(list)
    for shipment in shipments:
        by_customer[shipment.customer_name].append(shipment)

    result: list[CustomerIntelligence] = []
    for customer, items in sorted(by_customer.items()):
        mix: dict[str, float] = defaultdict(float)
        requested = approved = 0.0
        for shipment in items:
            for line in shipment.lines:
                mix[line.item_code] += line.quantity_requested
                requested += line.quantity_requested
                approved += line.quantity_approved

        request_dates = [shipment.request_date for shipment in items]
        span_days = (max(request_dates) - min(request_dates)).days if len(request_dates) > 1 else 0
        months = max(span_days / 30.0, 1.0)

        dispatched = on_time = 0
        for shipment in items:
            dispatch = dispatches.get(shipment.shipment_id)
            if dispatch:
                dispatched += 1
                if dispatch.dispatch_date <= shipment.required_delivery_date:
                    on_time += 1

        result.append(
            CustomerIntelligence(
                customer=customer,
                shipment_count=len(items),
                orders_per_month=round(len(items) / months, 2),
                product_mix=[
                    ProductMixEntry(item_code=item, quantity=quantity)
                    for item, quantity in sorted(mix.items(), key=lambda pair: -pair[1])
                ],
                fill_rate_pct=round(approved / requested * 100, 1) if requested else None,
                delivery_performance_pct=round(on_time / dispatched * 100, 1) if dispatched else None,
            )
        )
    return result


# --- Document intelligence (P5) ------------------------------------------

def document_intelligence() -> list[DocumentIntelligence]:
    documents = list_saved_documents()
    candidates = list_import_candidates()
    templates = list_document_templates()
    corrections = list_field_mapping_history()

    doc_meta: dict[str, tuple[str | None, str | None]] = {}
    for candidate in candidates:
        for doc_id in _candidate_document_ids(candidate):
            doc_meta[doc_id] = (candidate.supplier_name, candidate.destination_country)

    result: list[DocumentIntelligence] = []
    for doc in documents:
        supplier, country = doc_meta.get(doc.document_id, (None, None))
        doc_type = _document_type(doc.document_type)

        template_match = None
        if supplier:
            for template in templates:
                if template.supplier_name.lower() == supplier.lower() and template.document_type.lower() == doc_type.lower():
                    template_match = template
                    break

        confidence = None
        if doc.required_field_count > 0:
            confidence = round((doc.required_field_count - doc.missing_required_count) / doc.required_field_count * 100, 1)

        correction_count = sum(
            1 for correction in corrections if (correction.document_reference or "") in {doc.document_id, doc.filename}
        )

        result.append(
            DocumentIntelligence(
                document_id=doc.document_id,
                filename=doc.filename,
                document_type=doc_type,
                supplier=supplier,
                country=country,
                template_match=template_match is not None,
                template_id=template_match.template_id if template_match else None,
                ocr_confidence_pct=confidence,
                processing_time_ms=None,
                correction_count=correction_count,
            )
        )
    return result


# --- Knowledge relationships (P6) ----------------------------------------

def document_relationships(document_id: str) -> RelationshipMap:
    documents = {doc.document_id: doc for doc in list_saved_documents()}
    doc = documents.get(document_id)
    root = RelationshipNode(entity_type="document", id=document_id, label=doc.filename if doc else None)
    related: dict[str, list[RelationshipNode]] = defaultdict(list)

    receipts = list_goods_receipts()
    inventory = list_inventory_batches()
    shipments = list_shipments()
    dispatches = {dispatch.shipment_id: dispatch for dispatch in list_dispatches()}

    for candidate in list_import_candidates():
        if document_id not in _candidate_document_ids(candidate):
            continue
        related["import_shipment"].append(
            RelationshipNode(entity_type="import_shipment", id=candidate.import_file_number, label=candidate.shipment_name)
        )
        if candidate.supplier_name:
            related["supplier"].append(RelationshipNode(entity_type="supplier", id=candidate.supplier_name))
        grn = f"GRN-{candidate.import_file_number}"
        for receipt in receipts:
            if receipt.grn_number == grn:
                related["goods_receipt"].append(
                    RelationshipNode(entity_type="goods_receipt", id=receipt.grn_number, label=receipt.warehouse)
                )
        batch_keys = {line.batch_number.lower() for line in candidate.lines}
        for batch in inventory:
            if batch.batch_number.lower() in batch_keys:
                related["inventory_batch"].append(
                    RelationshipNode(entity_type="inventory_batch", id=batch.batch_number, label=batch.warehouse_location)
                )
        for shipment in shipments:
            if any(line.batch_number.lower() in batch_keys for line in shipment.lines):
                dispatch = dispatches.get(shipment.shipment_id)
                if dispatch:
                    related["dispatch"].append(
                        RelationshipNode(entity_type="dispatch", id=dispatch.dispatch_number, label=dispatch.dispatch_date.isoformat())
                    )
                related["customer"].append(RelationshipNode(entity_type="customer", id=shipment.customer_name))

    return RelationshipMap(root=root, related={key: _dedupe(value) for key, value in related.items()})


def supplier_relationships(supplier_name: str) -> RelationshipMap:
    candidates = [c for c in list_import_candidates() if (c.supplier_name or "").lower() == supplier_name.lower()]
    root = RelationshipNode(entity_type="supplier", id=supplier_name)
    related: dict[str, list[RelationshipNode]] = defaultdict(list)

    item_codes: set[str] = set()
    batch_keys: set[str] = set()
    grns = {f"GRN-{c.import_file_number}" for c in candidates}

    for candidate in candidates:
        related["import_shipment"].append(
            RelationshipNode(entity_type="import_shipment", id=candidate.import_file_number, label=candidate.shipment_name)
        )
        for line in candidate.lines:
            item_codes.add(line.item_code)
            batch_keys.add(line.batch_number.lower())
            related["product"].append(
                RelationshipNode(entity_type="product", id=line.item_code, label=line.product_description)
            )

    for receipt in list_goods_receipts():
        if receipt.grn_number in grns:
            related["warehouse"].append(RelationshipNode(entity_type="warehouse", id=receipt.warehouse))

    for shipment in list_shipments():
        if any(line.item_code in item_codes or line.batch_number.lower() in batch_keys for line in shipment.lines):
            related["customer"].append(RelationshipNode(entity_type="customer", id=shipment.customer_name))

    return RelationshipMap(root=root, related={key: _dedupe(value) for key, value in related.items()})
