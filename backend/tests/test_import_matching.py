"""Batch-aware import line matching for medical-device traceability."""

from app.services import import_repository as ir


def _packing_text() -> str:
    # Two rows for the SAME item code but DIFFERENT batches.
    return "\n".join(
        [
            "1", "HS", "X", "MDEV001", "Coronary Stent", "BATCHAA01", "01.01.2027", "10", "2.5",
            "2", "HS", "X", "MDEV001", "Coronary Stent", "BATCHBB02", "01.02.2027", "20", "3.0",
        ]
    )


def test_two_batches_of_same_item_stay_separate():
    parsed = ir.parse_packing_lines(_packing_text())
    assert len(parsed) == 2
    assert "MDEV001 / BATCHAA01" in parsed
    assert "MDEV001 / BATCHBB02" in parsed


def test_distinct_batches_never_merge_but_duplicates_sum():
    parsed = ir.parse_packing_lines(_packing_text())
    merged, _duplicates = ir.merge_line_maps([parsed, ir.parse_packing_lines(_packing_text())])
    # Distinct batches remain two separate lines...
    assert len(merged) == 2
    # ...while an identical item+batch seen twice sums its quantity (10 + 10).
    assert merged["MDEV001 / BATCHAA01"]["quantity"] == 20.0


def test_packing_line_key_format():
    assert ir.packing_line_key("ITM1", "") == "ITM1"
    assert ir.packing_line_key("ITM1", "B2") == "ITM1 / B2"
    assert ir.packing_line_key("ITM1", "  ") == "ITM1"
