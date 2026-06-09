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
    assert ir.packing_line_key("ITM1", "B2", "S9") == "ITM1 / B2 / S9"


def _catheter_packing_text() -> str:
    # A catheter row: batch immediately before the expiry date, no serial.
    return "\n".join(
        [
            "1", "ML01", "ML01", "MOZS20030", "MOZECSEB PTCA BALLOON",
            "CATHETER,2.00X30MM", "MOZSAB24", "23.04.2028", "1.000", "0.260",
        ]
    )


def _valve_packing_text() -> str:
    # A valve row: a serial number sits between the batch and the expiry date.
    return "\n".join(
        [
            "1", "ML01", "ML01", "DDL23A", "Dafodil 23mm Aortic",
            "DFB36", "A23DFB36024", "12.03.2028", "1.000", "0.725",
            "2", "ML01", "ML01", "DDL23A", "Dafodil 23mm Aortic",
            "DFB36", "A23DFB36025", "12.03.2028", "1.000", "0.725",
        ]
    )


def test_catheter_packing_has_batch_and_no_serial():
    parsed = ir.parse_packing_lines(_catheter_packing_text())
    assert len(parsed) == 1
    line = parsed["MOZS20030 / MOZSAB24"]
    assert line["batch_number"] == "MOZSAB24"
    assert line["serial_number"] is None
    assert str(line["expiry_date"]) == "2028-04-23"
    assert line["quantity"] == 1.0


def test_valve_packing_captures_serial_between_batch_and_expiry():
    parsed = ir.parse_packing_lines(_valve_packing_text())
    # Two serialised units of the same item+batch stay as two traceable lines.
    assert len(parsed) == 2
    first = parsed["DDL23A / DFB36 / A23DFB36024"]
    assert first["batch_number"] == "DFB36"
    assert first["serial_number"] == "A23DFB36024"
    assert str(first["expiry_date"]) == "2028-03-12"
    assert first["product_description"] == "Dafodil 23mm Aortic"
