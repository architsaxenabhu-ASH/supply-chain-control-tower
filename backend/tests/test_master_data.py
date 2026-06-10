"""Master data governance: dedup, active/inactive, attribution, change history."""

from app.schemas.master_data import (
    MasterEntityType,
    SetMasterStatusRequest,
    UpsertMasterRecordRequest,
)
from app.services import master_data_repository as mdr


def test_upsert_dedups_by_code_case_insensitive_and_tracks_attribution():
    mdr.upsert_master_record(
        UpsertMasterRecordRequest(
            entity_type=MasterEntityType.SUPPLIER, code="SUP-1", name="Meril", actor="creator@example.com"
        )
    )
    mdr.upsert_master_record(
        UpsertMasterRecordRequest(
            entity_type=MasterEntityType.SUPPLIER, code="sup-1", name="Meril Life", actor="editor@example.com"
        )
    )
    suppliers = mdr.list_master_records(entity_type="supplier")
    assert len(suppliers) == 1
    assert suppliers[0].name == "Meril Life"
    assert suppliers[0].created_by == "creator@example.com"
    assert suppliers[0].updated_by == "editor@example.com"


def test_duplicate_detection():
    mdr.upsert_master_record(
        UpsertMasterRecordRequest(entity_type=MasterEntityType.CARRIER, code="LH", name="Lufthansa", actor="qa")
    )
    assert mdr.check_duplicate("carrier", "lh").is_duplicate is True
    assert mdr.check_duplicate("carrier", "EK").is_duplicate is False


def test_deactivate_excludes_from_active_filter():
    mdr.upsert_master_record(
        UpsertMasterRecordRequest(entity_type=MasterEntityType.COUNTRY, code="IT", name="Italy", actor="qa")
    )
    mdr.set_master_status(
        SetMasterStatusRequest(entity_type=MasterEntityType.COUNTRY, code="IT", is_active=False, actor="qa")
    )
    active = mdr.list_master_records(entity_type="country", active_only=True)
    assert all(record.code != "IT" for record in active)


def test_change_history_is_recorded():
    mdr.upsert_master_record(
        UpsertMasterRecordRequest(entity_type=MasterEntityType.WAREHOUSE, code="WH9", name="DC9", actor="qa")
    )
    mdr.set_master_status(
        SetMasterStatusRequest(entity_type=MasterEntityType.WAREHOUSE, code="WH9", is_active=False, actor="qa")
    )
    history = mdr.master_record_history("warehouse", "WH9")
    assert len(history) >= 2  # create + deactivate
    assert any(event["action"] == "deactivate" for event in history)
