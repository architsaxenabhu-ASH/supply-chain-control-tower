"""Phase 2B operational intelligence: readiness, control tower, shipment, expiry prevention."""

from app.schemas.imports import ImportFileCandidate, ImportLineCandidate, ImportStatus
from app.schemas.operational_intelligence import DelayReasonRequest
from app.services import document_control_tower as dct
from app.services import document_readiness as dr_
from app.services import expiry_prevention as ep
from app.services import shipment_intelligence as si
from app.services.import_repository import save_import_candidate
from app.services.warehouse_repository import list_inventory_batches


def _seed_candidate(ifn="OPS-IT-1", **overrides):
    base = dict(
        import_file_number=ifn,
        destination_entity="Entity",
        destination_country="Italy",
        origin_country="India",
        status=ImportStatus.VALIDATION_PENDING,
        supplier_name="Meril",
        carrier_name="LH",
        commercial_invoice_document_ids=["ci-1"],
        packing_list_document_ids=[],
        lines=[
            ImportLineCandidate(
                item_code="IT-1", product_description="Cath", batch_number="BT-1", quantity=5, uom="EA", product_profile_status="known"
            )
        ],
    )
    base.update(overrides)
    return save_import_candidate(ImportFileCandidate(**base))


def test_readiness_missing_core_document_is_not_ready():
    _seed_candidate()
    readiness = next(r for r in dr_.document_readiness() if r.import_file_number == "OPS-IT-1")
    assert "Packing List" in readiness.missing_documents
    assert readiness.status == "Not Ready"
    assert 0 <= readiness.readiness_pct < 100


def test_control_tower_counts_and_aging_buckets():
    tower = dct.document_control_tower()
    assert tower.documents_pending >= 0
    aging = tower.aging
    assert aging.days_0_1 + aging.days_2_3 + aging.days_4_7 + aging.days_8_14 + aging.days_14_plus >= 0


def test_shipment_route_and_delay_reason_roundtrip():
    _seed_candidate(ifn="OPS-IT-2")
    si.record_delay_reason(
        DelayReasonRequest(
            import_file_number="OPS-IT-2",
            delay_category="Customs",
            delay_reason="Held at customs",
            root_cause="Import permit late",
            actor="qa@example.com",
        )
    )
    insight = next(i for i in si.shipment_intelligence() if i.import_file_number == "OPS-IT-2")
    assert insight.route == "India -> Italy"
    assert insight.delay_category == "Customs"
    assert insight.root_cause == "Import permit late"


def test_expiry_prevention_buckets_cover_every_batch():
    prevention = ep.expiry_prevention()
    buckets = prevention.buckets
    total = (
        buckets.under_6_months
        + buckets.months_6_12
        + buckets.months_12_24
        + buckets.over_24_months
        + buckets.expired
    )
    assert total == len(list_inventory_batches())
    assert 0 <= prevention.average_risk_score <= 100
