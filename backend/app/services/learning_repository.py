from collections import Counter
from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.learning import (
    CorrectionSuggestion,
    CorrectionSuggestionResponse,
    CountryDocumentRequirementRequest,
    CountryDocumentRequirementRule,
    CorrectionEventRequest,
    EntityAliasRequest,
    LearningInsights,
    LearningRule,
    LearningStat,
    ProductProfileEditEvent,
    ProductProfileEditRequest,
    ProductProfileFreeTextSaveRequest,
    ProductLearningProfile,
    ProductLearningProfileResponse,
    ProductProfileQuestion,
    WarehouseCandidate,
    WarehouseCandidateRequest,
)


LEARNING_RULES: list[LearningRule] = []

CORRECTION_EVENTS: list[CorrectionEventRequest] = []
ENTITY_ALIASES: list[EntityAliasRequest] = []
PRODUCT_PROFILE_EDIT_EVENTS: list[ProductProfileEditEvent] = []
COUNTRY_DOCUMENT_REQUIREMENT_RULES: list[CountryDocumentRequirementRule] = []
WAREHOUSE_CANDIDATES: list[WarehouseCandidate] = []

PRODUCT_PROFILES: dict[str, ProductLearningProfile] = {}


def _load_learning_state() -> None:
    LEARNING_RULES[:] = load_collection("learning_rules", lambda payload: LearningRule(**payload))
    CORRECTION_EVENTS[:] = load_collection("correction_events", lambda payload: CorrectionEventRequest(**payload))
    ENTITY_ALIASES[:] = load_collection("entity_aliases", lambda payload: EntityAliasRequest(**payload))
    PRODUCT_PROFILE_EDIT_EVENTS[:] = load_collection(
        "product_profile_edit_events",
        lambda payload: ProductProfileEditEvent(**payload),
    )
    COUNTRY_DOCUMENT_REQUIREMENT_RULES[:] = load_collection(
        "country_document_requirement_rules",
        lambda payload: CountryDocumentRequirementRule(**payload),
    )
    WAREHOUSE_CANDIDATES[:] = load_collection(
        "warehouse_candidates",
        lambda payload: WarehouseCandidate(**payload),
    )
    saved_profiles = load_collection(
        "product_learning_profiles",
        lambda payload: ProductLearningProfile(**payload),
    )
    PRODUCT_PROFILES.clear()
    PRODUCT_PROFILES.update({profile.item_code.upper(): profile for profile in saved_profiles})


def _save_learning_rules() -> None:
    save_collection(
        "learning_rules",
        LEARNING_RULES,
        lambda rule: "|".join(
            [rule.document_type, rule.source_text, rule.target_field, rule.corrected_value or ""]
        ),
    )


def _save_correction_events() -> None:
    save_collection(
        "correction_events",
        CORRECTION_EVENTS,
        lambda event: "|".join(
            [
                event.document_type,
                event.field_name,
                event.document_reference or "no_document",
                str(id(event)),
            ]
        ),
    )


def _save_entity_aliases() -> None:
    save_collection(
        "entity_aliases",
        ENTITY_ALIASES,
        lambda alias: "|".join([alias.entity_type.value, alias.alias_text, alias.master_code]),
    )


def _save_product_profiles() -> None:
    save_collection(
        "product_learning_profiles",
        PRODUCT_PROFILES.values(),
        lambda profile: profile.item_code.upper(),
    )


def _save_product_profile_edit_events() -> None:
    save_collection(
        "product_profile_edit_events",
        PRODUCT_PROFILE_EDIT_EVENTS,
        lambda event: "|".join(
            [
                event.item_code,
                event.field_name,
                event.edited_at.isoformat(),
            ]
        ),
    )


def _save_country_document_requirement_rules() -> None:
    save_collection(
        "country_document_requirement_rules",
        COUNTRY_DOCUMENT_REQUIREMENT_RULES,
        lambda rule: "|".join(
            [
                rule.country,
                rule.vertical,
                rule.material_code,
                rule.required_document_type,
            ]
        ),
    )


def _save_warehouse_candidates() -> None:
    save_collection(
        "warehouse_candidates",
        WAREHOUSE_CANDIDATES,
        lambda candidate: "|".join(
            [
                candidate.country,
                candidate.warehouse_name,
                candidate.created_at.isoformat(),
            ]
        ),
    )


_load_learning_state()


FIRST_TIME_PRODUCT_QUESTIONS = [
    ProductProfileQuestion(
        field_name="product_description",
        question="What is the official product description?",
        reason="Used for Product Master and document matching.",
    ),
    ProductProfileQuestion(
        field_name="product_category",
        question="Which product category does this item belong to?",
        reason="Used for dashboards, filters, and approval routing.",
    ),
    ProductProfileQuestion(
        field_name="uom",
        question="What is the default unit of measure?",
        reason="Used for quantity validation and inventory posting.",
    ),
    ProductProfileQuestion(
        field_name="batch_tracking_required",
        question="Is batch tracking required?",
        reason="Medical device traceability usually requires batch or lot tracking.",
    ),
    ProductProfileQuestion(
        field_name="serial_tracking_required",
        question="Is serial tracking required?",
        reason="Used for device-level traceability when applicable.",
    ),
    ProductProfileQuestion(
        field_name="expiry_tracking_required",
        question="Is expiry tracking required?",
        reason="Used for FEFO and expiry alerts.",
    ),
    ProductProfileQuestion(
        field_name="storage_condition",
        question="What is the storage condition?",
        reason="Used for warehouse handling and QA checks.",
    ),
    ProductProfileQuestion(
        field_name="temperature_requirement",
        question="What is the temperature requirement?",
        reason="Used for cold-chain and shipment validation.",
    ),
    ProductProfileQuestion(
        field_name="hs_code",
        question="What is the HS/HSN code?",
        reason="Used for customs and import reporting.",
    ),
]


def get_product_learning_profile(item_code: str) -> ProductLearningProfileResponse:
    profile = PRODUCT_PROFILES.get(item_code.upper())
    if profile:
        return ProductLearningProfileResponse(
            item_code=item_code,
            is_known=True,
            profile=profile,
            questions=[],
        )

    return ProductLearningProfileResponse(
        item_code=item_code,
        is_known=False,
        profile=None,
        questions=FIRST_TIME_PRODUCT_QUESTIONS,
    )


def save_product_learning_profile(profile: ProductLearningProfile) -> ProductLearningProfile:
    profile.profile_status = "complete"
    now = datetime.now()
    if not profile.created_at:
        profile.created_at = now
    profile.updated_at = now
    PRODUCT_PROFILES[profile.item_code.upper()] = profile
    _save_product_profiles()
    record_audit_event(
        action="save",
        module_name="learning",
        entity_name="product_learning_profile",
        entity_id=profile.item_code,
        actor=profile.updated_by or profile.created_by,
        new_value=profile,
    )
    return profile


def save_product_free_text_answers(request: ProductProfileFreeTextSaveRequest) -> ProductLearningProfile:
    existing_profile = PRODUCT_PROFILES.get(request.item_code.upper())
    profile = existing_profile or ProductLearningProfile(item_code=request.item_code)
    now = datetime.now()
    profile.free_text_answers.update(request.answers)
    profile.product_description = request.answers.get("product_description", profile.product_description)
    profile.product_category = request.answers.get("product_category", profile.product_category)
    profile.uom = request.answers.get("uom", profile.uom)
    profile.storage_condition = request.answers.get("storage_condition", profile.storage_condition)
    profile.temperature_requirement = request.answers.get("temperature_requirement", profile.temperature_requirement)
    profile.hs_code = request.answers.get("hs_code", profile.hs_code)

    profile.profile_status = "complete"
    if not profile.created_at:
        profile.created_at = now
        profile.created_by = request.answered_by
    profile.updated_at = now
    profile.updated_by = request.answered_by
    PRODUCT_PROFILES[request.item_code.upper()] = profile
    _save_product_profiles()
    record_audit_event(
        action="save_free_text",
        module_name="learning",
        entity_name="product_learning_profile",
        entity_id=request.item_code,
        actor=request.answered_by,
        new_value=profile,
    )
    return profile


def edit_product_learning_profile(request: ProductProfileEditRequest) -> ProductProfileEditEvent:
    if not request.edit_reason.strip():
        raise ValueError("Edit reason is mandatory")

    profile = PRODUCT_PROFILES.get(request.item_code.upper())
    if not profile:
        raise ValueError(f"Product learning profile not found: {request.item_code}")

    if hasattr(profile, request.field_name):
        setattr(profile, request.field_name, request.new_value)
    else:
        profile.free_text_answers[request.field_name] = request.new_value
    profile.updated_at = datetime.now()
    profile.updated_by = request.edited_by

    event = ProductProfileEditEvent(
        item_code=request.item_code,
        field_name=request.field_name,
        old_value=request.old_value,
        new_value=request.new_value,
        edit_reason=request.edit_reason,
        edited_by=request.edited_by,
        edited_at=datetime.now(),
    )
    PRODUCT_PROFILE_EDIT_EVENTS.append(event)
    _save_product_profiles()
    _save_product_profile_edit_events()
    record_audit_event(
        action="edit",
        module_name="learning",
        entity_name="product_learning_profile",
        entity_id=request.item_code,
        actor=request.edited_by,
        reason=request.edit_reason,
        old_value={request.field_name: request.old_value},
        new_value={request.field_name: request.new_value},
    )
    return event


def record_correction(event: CorrectionEventRequest) -> CorrectionEventRequest:
    CORRECTION_EVENTS.append(event)
    if event.original_value and event.corrected_value:
        # Reinforce an identical past rule so repeated corrections grow confidence
        # instead of piling up duplicates. A different corrected value for the same
        # source becomes its own competing rule.
        existing_rule = next(
            (
                rule
                for rule in LEARNING_RULES
                if rule.document_type == event.document_type
                and rule.source_text == event.original_value
                and rule.target_field == event.field_name
                and rule.corrected_value == event.corrected_value
            ),
            None,
        )
        if existing_rule:
            existing_rule.success_count += 1
            existing_rule.confidence = min(99, existing_rule.confidence + 5)
        else:
            LEARNING_RULES.append(
                LearningRule(
                    document_type=event.document_type,
                    source_text=event.original_value,
                    target_field=event.field_name,
                    corrected_value=event.corrected_value,
                    confidence=70,
                    success_count=1,
                    failure_count=0,
                )
            )
        _save_learning_rules()
    _save_correction_events()
    record_audit_event(
        action="correct",
        module_name="learning",
        entity_name="ocr_field",
        entity_id=event.document_reference or event.field_name,
        actor=event.corrected_by,
        reason=event.correction_reason,
        old_value={event.field_name: event.original_value},
        new_value={event.field_name: event.corrected_value},
    )
    return event


def record_entity_alias(alias: EntityAliasRequest) -> EntityAliasRequest:
    ENTITY_ALIASES.append(alias)
    _save_entity_aliases()
    record_audit_event(
        action="create",
        module_name="learning",
        entity_name="entity_alias",
        entity_id=f"{alias.entity_type.value}:{alias.alias_text}",
        actor="system_or_api_user",
        new_value=alias,
    )
    return alias


def list_learning_rules() -> list[LearningRule]:
    return LEARNING_RULES


def suggest_field_correction(
    document_type: str,
    field_name: str,
    current_value: str | None,
) -> CorrectionSuggestionResponse:
    """Suggest a corrected value the platform has already learned for this field.

    This is what makes repeat corrections disappear: once a human has fixed a
    given value on a given field, the same fix is offered automatically next time.
    """
    empty = CorrectionSuggestionResponse(field_name=field_name, current_value=current_value)
    if not current_value:
        return empty

    def matches(rule: LearningRule, same_document: bool) -> bool:
        if not rule.corrected_value or rule.target_field != field_name:
            return False
        if rule.source_text != current_value:
            return False
        if same_document:
            return rule.document_type == document_type
        return True

    # Prefer rules learned on the same document type, then fall back to any document.
    candidates = [rule for rule in LEARNING_RULES if matches(rule, same_document=True)]
    based_on = document_type
    if not candidates:
        candidates = [rule for rule in LEARNING_RULES if matches(rule, same_document=False)]
        based_on = "all documents"

    if not candidates:
        return empty

    best = max(candidates, key=lambda rule: (rule.confidence, rule.success_count))
    return CorrectionSuggestionResponse(
        field_name=field_name,
        current_value=current_value,
        suggestion=CorrectionSuggestion(
            suggested_value=best.corrected_value or "",
            confidence=best.confidence,
            times_seen=best.success_count,
            based_on=based_on,
        ),
    )


def _top_stats(counter: Counter[str], limit: int = 6) -> list[LearningStat]:
    return [
        LearningStat(label=label, count=count)
        for label, count in counter.most_common(limit)
        if label
    ]


def get_learning_insights() -> LearningInsights:
    """Aggregate every learned signal into one summary for the Learning Center.

    This is read-only: it never changes what has been learned, it only reports
    on it so a non-technical user can see the platform getting smarter.
    """
    field_counter: Counter[str] = Counter(
        event.field_name for event in CORRECTION_EVENTS if event.field_name
    )
    document_counter: Counter[str] = Counter(
        event.document_type for event in CORRECTION_EVENTS if event.document_type
    )

    average_confidence = (
        round(sum(rule.confidence for rule in LEARNING_RULES) / len(LEARNING_RULES), 1)
        if LEARNING_RULES
        else 0
    )

    top_rules = sorted(
        LEARNING_RULES,
        key=lambda rule: (rule.confidence, rule.success_count),
        reverse=True,
    )[:8]

    recent_corrections = list(reversed(CORRECTION_EVENTS))[:8]

    return LearningInsights(
        total_learning_rules=len(LEARNING_RULES),
        total_corrections=len(CORRECTION_EVENTS),
        total_product_profiles=len(PRODUCT_PROFILES),
        total_country_document_rules=len(COUNTRY_DOCUMENT_REQUIREMENT_RULES),
        total_entity_aliases=len(ENTITY_ALIASES),
        total_warehouse_candidates=len(WAREHOUSE_CANDIDATES),
        average_rule_confidence=average_confidence,
        top_corrected_fields=_top_stats(field_counter),
        corrections_by_document_type=_top_stats(document_counter),
        top_learned_rules=top_rules,
        country_document_rules=COUNTRY_DOCUMENT_REQUIREMENT_RULES[:12],
        recent_corrections=recent_corrections,
    )


def learn_country_document_requirement(
    request: CountryDocumentRequirementRequest,
) -> CountryDocumentRequirementRule:
    for rule in COUNTRY_DOCUMENT_REQUIREMENT_RULES:
        if (
            rule.country.lower() == request.country.lower()
            and rule.vertical.lower() == request.vertical.lower()
            and rule.material_code.lower() == request.material_code.lower()
            and rule.required_document_type.lower() == request.required_document_type.lower()
        ):
            rule.success_count += 1
            rule.confidence = min(99, rule.confidence + 5)
            _save_country_document_requirement_rules()
            record_audit_event(
                action="reinforce",
                module_name="learning",
                entity_name="country_document_requirement",
                entity_id=f"{rule.country}/{rule.vertical}/{rule.material_code}/{rule.required_document_type}",
                actor=request.approved_by,
                new_value=rule,
            )
            return rule

    rule = CountryDocumentRequirementRule(
        country=request.country,
        vertical=request.vertical,
        material_code=request.material_code,
        required_document_type=request.required_document_type,
        approved_by=request.approved_by,
        confidence=70,
        success_count=1,
    )
    COUNTRY_DOCUMENT_REQUIREMENT_RULES.append(rule)
    _save_country_document_requirement_rules()
    record_audit_event(
        action="create",
        module_name="learning",
        entity_name="country_document_requirement",
        entity_id=f"{rule.country}/{rule.vertical}/{rule.material_code}/{rule.required_document_type}",
        actor=request.approved_by,
        new_value=rule,
    )
    return rule


def get_country_document_requirements(
    country: str,
    vertical: str,
    material_code: str,
) -> list[CountryDocumentRequirementRule]:
    return [
        rule
        for rule in COUNTRY_DOCUMENT_REQUIREMENT_RULES
        if rule.country.lower() == country.lower()
        and rule.vertical.lower() == vertical.lower()
        and rule.material_code.lower() == material_code.lower()
    ]


def create_warehouse_candidate(request: WarehouseCandidateRequest) -> WarehouseCandidate:
    candidate = WarehouseCandidate(
        country=request.country,
        warehouse_name=request.warehouse_name,
        created_from_import_file=request.created_from_import_file,
        created_by=request.created_by,
    )
    WAREHOUSE_CANDIDATES.append(candidate)
    _save_warehouse_candidates()
    record_audit_event(
        action="create",
        module_name="learning",
        entity_name="warehouse_candidate",
        entity_id=f"{candidate.country}/{candidate.warehouse_name}",
        actor=request.created_by,
        new_value=candidate,
    )
    return candidate
