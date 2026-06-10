"""Supplier / carrier / customer / document intelligence + knowledge relationships."""

from datetime import date

from app.schemas.imports import ImportFileCandidate, ImportLineCandidate, ImportStatus
from app.schemas.warehouse import GoodsReceipt, GoodsReceiptLine
from app.services import business_intelligence as bi
from app.services import warehouse_repository as wr
from app.services.import_repository import save_import_candidate

IFN = "TEST-CARDIO-9001"


def _seed_import_with_receipt():
    save_import_candidate(
        ImportFileCandidate(
            import_file_number=IFN,
            destination_entity="Test Entity",
            destination_country="Testland",
            status=ImportStatus.RECEIVED,
            supplier_name="Test Supplier",
            carrier_name="Test Carrier",
            flight_date=date(2026, 1, 1),
            source_document_ids=["doc-xyz"],
            lines=[
                ImportLineCandidate(
                    item_code="IT-1",
                    product_description="Widget",
                    batch_number="BT-1",
                    quantity=10,
                    uom="EA",
                    product_profile_status="known",
                )
            ],
        )
    )
    receipt = GoodsReceipt(
        grn_number=f"GRN-{IFN}",
        receipt_date=date(2026, 1, 6),
        warehouse="Test WH",
        supplier="Test Supplier",
        status="posted",
        lines=[
            GoodsReceiptLine(item_code="IT-1", batch_number="BT-1", quantity_received=10, expiry_date=date(2027, 1, 1), unit_value=5)
        ],
    )
    if all(existing.grn_number != receipt.grn_number for existing in wr.GOODS_RECEIPTS):
        wr.GOODS_RECEIPTS.append(receipt)
        wr._save_goods_receipts()


def test_supplier_intelligence_computes_lead_time():
    _seed_import_with_receipt()
    suppliers = {s.supplier: s for s in bi.supplier_intelligence()}
    assert "Test Supplier" in suppliers
    assert suppliers["Test Supplier"].shipment_count >= 1
    assert suppliers["Test Supplier"].average_lead_time_days == 5.0


def test_carrier_intelligence_computes_transit():
    _seed_import_with_receipt()
    carriers = {c.carrier: c for c in bi.carrier_intelligence()}
    assert "Test Carrier" in carriers
    assert carriers["Test Carrier"].average_transit_days == 5.0


def test_customer_intelligence_fill_rate_in_range():
    for customer in bi.customer_intelligence():
        if customer.fill_rate_pct is not None:
            assert 0 <= customer.fill_rate_pct <= 100
        if customer.delivery_performance_pct is not None:
            assert 0 <= customer.delivery_performance_pct <= 100


def test_document_intelligence_confidence_in_range():
    for document in bi.document_intelligence():
        assert document.document_id
        if document.ocr_confidence_pct is not None:
            assert 0 <= document.ocr_confidence_pct <= 100


def test_supplier_relationships_link_products_and_warehouses():
    _seed_import_with_receipt()
    rel = bi.supplier_relationships("Test Supplier")
    assert rel.root.entity_type == "supplier"
    assert "IT-1" in [node.id for node in rel.related.get("product", [])]
    assert "Test WH" in [node.id for node in rel.related.get("warehouse", [])]


def test_document_relationships_reach_import_shipment():
    _seed_import_with_receipt()
    rel = bi.document_relationships("doc-xyz")
    assert IFN in [node.id for node in rel.related.get("import_shipment", [])]
