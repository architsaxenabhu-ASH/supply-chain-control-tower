"""Country/vertical/material import document checklist."""

from app.services import learning_repository as lr
from app.schemas.learning import CountryDocumentRequirementRule


def test_unknown_combination_prompts_user():
    lr.COUNTRY_DOCUMENT_REQUIREMENT_RULES.clear()
    response = lr.evaluate_import_checklist("Italy", "Cardio", "ITM-1", ["commercial_invoice"])
    assert response.is_known is False
    assert response.required_count == 0


def test_known_combination_reports_present_and_missing():
    lr.COUNTRY_DOCUMENT_REQUIREMENT_RULES.clear()
    lr.COUNTRY_DOCUMENT_REQUIREMENT_RULES.extend(
        [
            CountryDocumentRequirementRule(
                country="Italy", vertical="Cardio", material_code="ITM-1",
                required_document_type="Certificate of Origin", confidence=80, success_count=3,
            ),
            CountryDocumentRequirementRule(
                country="Italy", vertical="Cardio", material_code="ITM-1",
                required_document_type="Packing List", confidence=75, success_count=2,
            ),
        ]
    )
    response = lr.evaluate_import_checklist(
        "Italy", "Cardio", "ITM-1", ["commercial_invoice", "packing_list"]
    )
    assert response.is_known is True
    assert response.required_count == 2
    # "Packing List" matches the uploaded "packing_list" after normalisation.
    assert response.present_count == 1
    assert response.missing_count == 1


def test_checklist_is_case_and_format_insensitive_for_presence():
    lr.COUNTRY_DOCUMENT_REQUIREMENT_RULES.clear()
    lr.COUNTRY_DOCUMENT_REQUIREMENT_RULES.append(
        CountryDocumentRequirementRule(
            country="Italy", vertical="Cardio", material_code="ITM-1",
            required_document_type="Air Waybill", confidence=70, success_count=1,
        )
    )
    response = lr.evaluate_import_checklist("Italy", "Cardio", "ITM-1", ["air_waybill"])
    assert response.present_count == 1
