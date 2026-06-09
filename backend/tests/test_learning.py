"""Self-learning: correction capture, reinforcement, suggestions, insights."""

from app.services import learning_repository as lr
from app.schemas.learning import CorrectionEventRequest


def _reset() -> None:
    lr.LEARNING_RULES.clear()
    lr.CORRECTION_EVENTS.clear()


def _correct(corrected_value: str) -> None:
    lr.record_correction(
        CorrectionEventRequest(
            document_type="commercial_invoice",
            field_name="hs_code",
            original_value="9018",
            corrected_value=corrected_value,
            corrected_by="qa@example.com",
        )
    )


def test_record_correction_stores_corrected_value():
    _reset()
    _correct("90183900")
    assert len(lr.LEARNING_RULES) == 1
    rule = lr.LEARNING_RULES[0]
    assert rule.corrected_value == "90183900"
    assert rule.success_count == 1


def test_identical_correction_reinforces_instead_of_duplicating():
    _reset()
    _correct("90183900")
    _correct("90183900")
    assert len(lr.LEARNING_RULES) == 1
    assert lr.LEARNING_RULES[0].success_count == 2
    assert lr.LEARNING_RULES[0].confidence == 75


def test_different_corrected_value_creates_competing_rule():
    _reset()
    _correct("90183900")
    _correct("90189099")
    assert len(lr.LEARNING_RULES) == 2


def test_suggestion_prefers_highest_confidence_value():
    _reset()
    _correct("90183900")
    _correct("90183900")  # reinforced -> confidence 75
    _correct("90189099")  # competing -> confidence 70
    response = lr.suggest_field_correction("commercial_invoice", "hs_code", "9018")
    assert response.suggestion is not None
    assert response.suggestion.suggested_value == "90183900"


def test_suggestion_falls_back_across_document_types():
    _reset()
    _correct("90183900")  # learned on commercial_invoice
    response = lr.suggest_field_correction("air_waybill", "hs_code", "9018")
    assert response.suggestion is not None
    assert response.suggestion.based_on == "all documents"


def test_no_suggestion_for_unknown_value():
    _reset()
    _correct("90183900")
    assert lr.suggest_field_correction("commercial_invoice", "hs_code", "0000").suggestion is None


def test_insights_aggregate_totals_and_top_fields():
    _reset()
    _correct("90183900")
    lr.record_correction(
        CorrectionEventRequest(
            document_type="packing_list",
            field_name="batch_number",
            original_value="B1",
            corrected_value="LOT-B1",
            corrected_by="qa@example.com",
        )
    )
    insights = lr.get_learning_insights()
    assert insights.total_corrections == 2
    assert insights.total_learning_rules == 2
    labels = {stat.label for stat in insights.top_corrected_fields}
    assert {"hs_code", "batch_number"} <= labels
