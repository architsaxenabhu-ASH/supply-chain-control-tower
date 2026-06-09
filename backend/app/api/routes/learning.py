from fastapi import APIRouter, HTTPException

from app.schemas.learning import (
    CorrectionSuggestionResponse,
    CountryDocumentRequirementRequest,
    CountryDocumentRequirementRule,
    CorrectionEventRequest,
    EntityAliasRequest,
    ImportChecklistRequest,
    ImportChecklistResponse,
    LearningInsights,
    LearningRule,
    ProductProfileEditEvent,
    ProductProfileEditRequest,
    ProductProfileFreeTextSaveRequest,
    ProductLearningProfile,
    ProductLearningProfileResponse,
    WarehouseCandidate,
    WarehouseCandidateRequest,
)
from app.services.learning_repository import (
    create_warehouse_candidate,
    evaluate_import_checklist,
    get_learning_insights,
    get_product_learning_profile,
    get_country_document_requirements,
    learn_country_document_requirement,
    list_learning_rules,
    suggest_field_correction,
    record_correction,
    record_entity_alias,
    edit_product_learning_profile,
    save_product_free_text_answers,
    save_product_learning_profile,
)


router = APIRouter()


@router.get("/rules", response_model=list[LearningRule])
def rules() -> list[LearningRule]:
    return list_learning_rules()


@router.get("/insights", response_model=LearningInsights)
def insights() -> LearningInsights:
    return get_learning_insights()


@router.get("/suggest-correction", response_model=CorrectionSuggestionResponse)
def suggest_correction(
    document_type: str,
    field_name: str,
    current_value: str | None = None,
) -> CorrectionSuggestionResponse:
    return suggest_field_correction(
        document_type=document_type,
        field_name=field_name,
        current_value=current_value,
    )


@router.get("/product-profiles/{item_code}", response_model=ProductLearningProfileResponse)
def product_profile(item_code: str) -> ProductLearningProfileResponse:
    return get_product_learning_profile(item_code)


@router.post("/product-profiles", response_model=ProductLearningProfile)
def save_product_profile(profile: ProductLearningProfile) -> ProductLearningProfile:
    return save_product_learning_profile(profile)


@router.post("/product-profiles/free-text", response_model=ProductLearningProfile)
def save_free_text_profile(request: ProductProfileFreeTextSaveRequest) -> ProductLearningProfile:
    return save_product_free_text_answers(request)


@router.post("/product-profiles/edits", response_model=ProductProfileEditEvent)
def edit_product_profile(request: ProductProfileEditRequest) -> ProductProfileEditEvent:
    try:
        return edit_product_learning_profile(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/corrections", response_model=CorrectionEventRequest)
def correction(event: CorrectionEventRequest) -> CorrectionEventRequest:
    return record_correction(event)


@router.post("/aliases", response_model=EntityAliasRequest)
def alias(event: EntityAliasRequest) -> EntityAliasRequest:
    return record_entity_alias(event)


@router.post("/country-document-requirements", response_model=CountryDocumentRequirementRule)
def country_document_requirement(
    request: CountryDocumentRequirementRequest,
) -> CountryDocumentRequirementRule:
    return learn_country_document_requirement(request)


@router.get("/country-document-requirements", response_model=list[CountryDocumentRequirementRule])
def country_document_requirements(
    country: str,
    vertical: str,
    material_code: str,
) -> list[CountryDocumentRequirementRule]:
    return get_country_document_requirements(
        country=country,
        vertical=vertical,
        material_code=material_code,
    )


@router.post("/import-checklist", response_model=ImportChecklistResponse)
def import_checklist(request: ImportChecklistRequest) -> ImportChecklistResponse:
    return evaluate_import_checklist(
        country=request.country,
        vertical=request.vertical,
        material_code=request.material_code,
        present_document_types=request.present_document_types,
    )


@router.post("/warehouse-candidates", response_model=WarehouseCandidate)
def warehouse_candidate(request: WarehouseCandidateRequest) -> WarehouseCandidate:
    return create_warehouse_candidate(request)
