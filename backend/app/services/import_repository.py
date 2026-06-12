import re
from datetime import date
from pathlib import Path

from app.schemas.extraction import DocumentType
from app.schemas.imports import (
    ImportApprovalRequest,
    ImportAssemblyRequest,
    ImportDeliveryRequest,
    ImportFileCandidate,
    ImportGoodsReceiptPostRequest,
    ImportLineCandidate,
    ImportStatus,
    ShipmentMilestone,
    ShipmentPlan,
    ShipmentPlanRequest,
    ShipmentTimeline,
)
from app.schemas.security import ApprovalResolutionRequest
from app.schemas.warehouse import CreateGoodsReceiptLineRequest, CreateGoodsReceiptRequest, CreateProductRequest, WorkflowResult
from app.db.local_persistence import list_audit_events, load_collection, record_audit_event, save_collection
from app.services.learning_repository import get_product_learning_profile
from app.services.local_document_store import get_saved_document
from app.services.security_repository import (
    ensure_country_scope,
    normalize_email,
    require_user_permission,
    resolve_approver,
)
from app.services.simple_extraction import extract_text
from app.services.warehouse_repository import create_product, get_product, post_goods_receipt


def latest_import_candidate() -> ImportFileCandidate:
    candidates = list_import_candidates()
    return candidates[0] if candidates else exp_0361_development_fixture()


def list_import_candidates() -> list[ImportFileCandidate]:
    return load_collection(
        "import_candidates",
        lambda payload: ImportFileCandidate(**payload),
    )


def get_import_candidate(import_file_number: str) -> ImportFileCandidate | None:
    return next(
        (
            candidate
            for candidate in list_import_candidates()
            if candidate.import_file_number == import_file_number
        ),
        None,
    )


def save_import_candidate(candidate: ImportFileCandidate) -> ImportFileCandidate:
    candidates = [
        saved_candidate
        for saved_candidate in list_import_candidates()
        if saved_candidate.import_file_number != candidate.import_file_number
    ]
    candidates.insert(0, candidate)
    save_collection(
        "import_candidates",
        candidates,
        lambda saved_candidate: saved_candidate.import_file_number,
    )
    return candidate


def assemble_import_candidate_from_documents(
    request: ImportAssemblyRequest,
) -> ImportFileCandidate:
    invoice_document_ids = normalize_document_ids(
        request.commercial_invoice_document_ids,
        request.commercial_invoice_document_id,
    )
    packing_document_ids = normalize_document_ids(
        request.packing_list_document_ids,
        request.packing_list_document_id,
    )
    if not invoice_document_ids:
        raise ValueError("Select at least one Commercial Invoice.")
    if not packing_document_ids:
        raise ValueError("Select at least one Packing List.")

    invoice_records = [
        require_document(document_id, DocumentType.COMMERCIAL_INVOICE)
        for document_id in invoice_document_ids
    ]
    packing_records = [
        require_document(document_id, DocumentType.PACKING_LIST)
        for document_id in packing_document_ids
    ]
    awb_record = (
        require_document(request.awb_document_id, DocumentType.AIR_WAYBILL)
        if request.awb_document_id
        else None
    )

    invoice_texts = [extract_text(Path(record.saved_path)) for record in invoice_records]
    packing_texts = [extract_text(Path(record.saved_path)) for record in packing_records]
    awb_text = extract_text(Path(awb_record.saved_path)) if awb_record else ""

    warnings: list[str] = []
    for record, text in zip(invoice_records, invoice_texts):
        if not text.strip():
            warnings.append(f"{record.filename} has no readable text. Manual invoice validation is required.")
    for record, text in zip(packing_records, packing_texts):
        if not text.strip():
            warnings.append(f"{record.filename} has no readable text. Manual packing-list validation is required.")
    if awb_record and not awb_text.strip():
        warnings.append("AWB has no readable text. OCR must be installed or AWB fields must be validated manually.")
    if not awb_record:
        warnings.append("AWB was not selected. AWB fields are pending.")
    if len(invoice_records) > 1:
        warnings.append(f"{len(invoice_records)} commercial invoices are linked to this shipment.")
    if len(packing_records) > 1:
        warnings.append(f"{len(packing_records)} packing lists are linked to this shipment.")

    invoice_headers = [parse_invoice_header(text) for text in invoice_texts]
    packing_headers = [parse_packing_header(text) for text in packing_texts]
    awb_header = parse_awb_header(awb_text)
    invoice_lines, duplicated_invoice_items = merge_line_maps(
        [parse_invoice_lines(text) for text in invoice_texts],
    )
    packing_lines, duplicated_packing_items = merge_line_maps(
        [parse_packing_lines(text) for text in packing_texts],
    )
    duplicated_items = sorted(duplicated_invoice_items | duplicated_packing_items)
    if duplicated_items:
        warnings.append(
            "Duplicate item/batch rows across selected documents were merged. Validate quantities for: "
            + ", ".join(duplicated_items[:12])
        )

    invoice_currency = string_or_none(first_header_value(invoice_headers, "currency"))

    def build_line(item_code: str, invoice_line: dict, packing_line: dict) -> ImportLineCandidate:
        profile_response = get_product_learning_profile(item_code)
        learned_uom = profile_response.profile.uom if profile_response.profile else None
        return ImportLineCandidate(
            item_code=item_code,
            product_description=str(
                invoice_line.get("product_description")
                or packing_line.get("product_description")
                or item_code
            ),
            batch_number=str(packing_line.get("batch_number") or ""),
            serial_number=string_or_none(packing_line.get("serial_number")),
            expiry_date=packing_line.get("expiry_date"),
            quantity=float(packing_line.get("quantity") or invoice_line.get("quantity") or 0),
            uom=str(learned_uom or invoice_line.get("uom") or "EA"),
            unit_value=to_float(invoice_line.get("unit_value")),
            currency=invoice_currency,
            product_profile_status="known"
            if profile_response.is_known
            else "first_time_questions_required",
        )

    # One line per (item code + batch) from the packing lists, joined to invoice
    # data by item code. Items that appear only on the invoice (no packing batch)
    # still produce a single line with an empty batch number.
    lines: list[ImportLineCandidate] = []
    items_with_batches: set[str] = set()
    for packing_line in packing_lines.values():
        item_code = str(packing_line.get("item_code") or "").strip()
        if not item_code:
            continue
        invoice_line = invoice_lines.get(item_code, {})
        lines.append(build_line(item_code, invoice_line, packing_line))
        items_with_batches.add(item_code)

    for item_code, invoice_line in invoice_lines.items():
        if item_code in items_with_batches:
            continue
        lines.append(build_line(item_code, invoice_line, {}))

    if not lines:
        warnings.append("No product lines were extracted. Upload readable invoice and packing list files.")

    requested_country = normalize_optional_text(request.shipment_country)
    requested_vertical = normalize_optional_text(request.shipment_vertical)
    requested_shipment_number = normalize_optional_text(request.shipment_number)
    destination_country_value = (
        requested_country
        or first_header_value(invoice_headers, "destination_country")
        or first_header_value(packing_headers, "destination_country")
        or "Unknown"
    )
    destination_country = str(destination_country_value).strip() or "Unknown"
    invoice_numbers = unique_values(
        [
            *[header.get("invoice_number") for header in invoice_headers],
            *[header.get("invoice_number") for header in packing_headers],
        ]
    )
    invoice_number = ", ".join(invoice_numbers) if invoice_numbers else None
    shipment_vertical = requested_vertical or "General"
    shipment_number = (
        requested_shipment_number
        or awb_header.get("awb_number")
        or first_value(invoice_numbers)
        or invoice_records[0].document_id
    )
    shipment_name = build_shipment_name(
        country=destination_country,
        vertical=shipment_vertical,
        shipment_number=str(shipment_number),
        fallback_document_id=invoice_records[0].document_id,
    )
    import_file_number = shipment_name
    source_document_ids = [
        *[record.document_id for record in invoice_records],
        *[record.document_id for record in packing_records],
        *([awb_record.document_id] if awb_record else []),
    ]

    candidate = ImportFileCandidate(
        import_file_number=import_file_number,
        shipment_name=shipment_name,
        shipment_vertical=shipment_vertical,
        shipment_number=str(shipment_number),
        supplier_name=string_or_none(first_header_value(invoice_headers, "supplier_name")),
        destination_entity=string_or_none(
            first_header_value(invoice_headers, "destination_entity")
            or first_header_value(packing_headers, "destination_entity")
            or "Unknown"
        )
        or "Unknown",
        destination_country=destination_country,
        status=ImportStatus.VALIDATION_PENDING,
        invoice_number=invoice_number,
        invoice_date=first_header_value(invoice_headers, "invoice_date") or first_header_value(packing_headers, "invoice_date"),
        awb_number=string_or_none(awb_header.get("awb_number") or first_header_value(invoice_headers, "awb_number")),
        origin_country=string_or_none(
            first_header_value(invoice_headers, "origin_country") or first_header_value(packing_headers, "origin_country")
        ),
        carrier_name=string_or_none(awb_header.get("carrier_name")),
        flight_number=string_or_none(awb_header.get("flight_number")),
        flight_date=awb_header.get("flight_date"),
        package_count=first_header_value(invoice_headers, "package_count") or first_header_value(packing_headers, "package_count") or awb_header.get("package_count"),
        gross_weight_kg=first_header_value(invoice_headers, "gross_weight_kg") or first_header_value(packing_headers, "gross_weight_kg") or awb_header.get("gross_weight_kg"),
        chargeable_weight_kg=awb_header.get("chargeable_weight_kg"),
        lines=lines,
        invoice_numbers=invoice_numbers,
        commercial_invoice_document_ids=[record.document_id for record in invoice_records],
        packing_list_document_ids=[record.document_id for record in packing_records],
        awb_document_id=awb_record.document_id if awb_record else None,
        source_document_ids=source_document_ids,
        extraction_warnings=warnings,
    )
    save_import_candidate(candidate)
    record_audit_event(
        action="assemble",
        module_name="import",
        entity_name="import_file",
        entity_id=candidate.import_file_number,
        actor="document_upload_flow",
        new_value={
            "status": candidate.status.value,
            "line_count": len(candidate.lines),
            "shipment_name": candidate.shipment_name,
            "commercial_invoice_count": len(candidate.commercial_invoice_document_ids),
            "packing_list_count": len(candidate.packing_list_document_ids),
            "awb_document_id": candidate.awb_document_id,
        },
    )
    return candidate


def post_import_goods_receipt(request: ImportGoodsReceiptPostRequest) -> WorkflowResult:
    posted_user = require_user_permission(request.auth_token, "goods_receipt")
    if request.candidate.status == ImportStatus.VALIDATED:
        raise ValueError("Mark the shipment as delivered before posting Goods Receipt")
    if request.candidate.status != ImportStatus.ARRIVED:
        raise ValueError("Goods Receipt can be posted only after the shipment is approved and delivered")
    if not request.warehouse_name.strip():
        raise ValueError("Destination warehouse is mandatory")
    if not request.candidate.lines:
        raise ValueError("Import file has no product lines to receive")

    receipt_lines: list[CreateGoodsReceiptLineRequest] = []
    for line in request.candidate.lines:
        if not line.batch_number.strip():
            raise ValueError(f"Batch number is missing for {line.item_code}")
        if line.expiry_date is None:
            raise ValueError(f"Expiry date is missing for {line.item_code} / {line.batch_number}")
        if line.quantity <= 0:
            raise ValueError(f"Quantity must be greater than zero for {line.item_code} / {line.batch_number}")
        ensure_pending_product_master(line)
        receipt_lines.append(
            CreateGoodsReceiptLineRequest(
                item_code=line.item_code,
                batch_number=line.batch_number,
                quantity_received=line.quantity,
                expiry_date=line.expiry_date,
                unit_value=line.unit_value or 0,
                currency=line.currency,
            )
        )

    supplier_name = (
        request.supplier_name
        or request.candidate.supplier_name
        or request.candidate.origin_country
        or "Unknown Supplier"
    )
    result = post_goods_receipt(
        CreateGoodsReceiptRequest(
            grn_number=f"GRN-{request.candidate.import_file_number}",
            receipt_date=date.today(),
            warehouse=request.warehouse_name.strip(),
            supplier=supplier_name,
            lines=receipt_lines,
        )
    )
    result.data.update(
        {
            "import_file_number": request.candidate.import_file_number,
            "warehouse": request.warehouse_name.strip(),
            "posted_by": posted_user.email,
        }
    )
    received_candidate = request.candidate.model_copy(
        update={"status": ImportStatus.RECEIVED},
    )
    save_import_candidate(received_candidate)
    record_audit_event(
        action="post_goods_receipt",
        module_name="import",
        entity_name="import_file",
        entity_id=request.candidate.import_file_number,
        actor=posted_user.email,
        new_value=result.data,
    )
    return result


def approve_import_candidate(request: ImportApprovalRequest) -> ImportFileCandidate:
    approving_user = require_user_permission(request.auth_token, "import_approval")
    ensure_country_scope(approving_user, request.candidate.destination_country, "approve imports")
    if not request.candidate.lines:
        raise ValueError("Import file has no product lines to approve")

    if normalize_email(request.approved_by) != approving_user.email:
        raise ValueError("Approval request does not match logged-in user.")

    # An Admin can approve any import. Otherwise a country approval rule must
    # exist and the logged-in user must be its configured approver.
    if approving_user.role_name != "Admin":
        resolution = resolve_approver(
            ApprovalResolutionRequest(
                process_name="import_approval",
                country=request.candidate.destination_country,
                vertical="All",
                material_code="All",
            )
        )
        if not resolution.approver_email:
            raise ValueError(
                "No import approval rule is configured. Add one in Security for this destination country."
            )
        if approving_user.email != resolution.approver_email:
            raise ValueError(f"Only configured approver {resolution.approver_email} can approve this import file")

    for line in request.candidate.lines:
        if not line.item_code.strip():
            raise ValueError("Item code is missing on one or more import lines")
        if not line.batch_number.strip():
            raise ValueError(f"Batch number is missing for {line.item_code}")
        if line.expiry_date is None:
            raise ValueError(f"Expiry date is missing for {line.item_code} / {line.batch_number}")
        if line.quantity <= 0:
            raise ValueError(f"Quantity must be greater than zero for {line.item_code} / {line.batch_number}")

    approved_candidate = request.candidate.model_copy(
        update={"status": ImportStatus.VALIDATED},
    )
    save_import_candidate(approved_candidate)
    record_audit_event(
        action="approve",
        module_name="import",
        entity_name="import_file",
        entity_id=request.candidate.import_file_number,
        actor=approving_user.email,
        reason=request.approval_note,
        old_value={"status": request.candidate.status.value},
        new_value={"status": approved_candidate.status.value},
    )
    return approved_candidate


def mark_import_delivered(request: ImportDeliveryRequest) -> ImportFileCandidate:
    """Record that the physical goods have arrived/been delivered. Goods Receipt
    can only be posted after this step, so stock is never increased before the
    shipment is actually in the destination warehouse."""
    acting_user = require_user_permission(request.auth_token, "goods_receipt")
    ensure_country_scope(acting_user, request.candidate.destination_country, "mark deliveries")
    if request.candidate.status != ImportStatus.VALIDATED:
        raise ValueError("Import file must be approved before it can be marked delivered")

    delivered_candidate = request.candidate.model_copy(
        update={"status": ImportStatus.ARRIVED},
    )
    save_import_candidate(delivered_candidate)
    record_audit_event(
        action="mark_delivered",
        module_name="import",
        entity_name="import_file",
        entity_id=request.candidate.import_file_number,
        actor=acting_user.email,
        reason=request.delivery_note,
        old_value={"status": request.candidate.status.value},
        new_value={"status": delivered_candidate.status.value},
    )
    return delivered_candidate


def save_shipment_plan(request: ShipmentPlanRequest) -> ShipmentPlan:
    """Capture the planned arrival / delivery dates for an import shipment so the
    timeline can compare planned vs actual."""
    plans = load_collection("shipment_plans", lambda payload: ShipmentPlan(**payload))
    plan = ShipmentPlan(
        import_file_number=request.import_file_number,
        planned_arrival_date=request.planned_arrival_date,
        planned_delivery_date=request.planned_delivery_date,
    )
    save_collection(
        "shipment_plans",
        [plan, *[saved for saved in plans if saved.import_file_number != plan.import_file_number]],
        lambda saved: saved.import_file_number,
    )
    record_audit_event(
        action="plan",
        module_name="import",
        entity_name="shipment_plan",
        entity_id=plan.import_file_number,
        actor=request.actor,
        new_value=plan,
    )
    return plan


def get_shipment_plan(import_file_number: str) -> ShipmentPlan | None:
    plans = load_collection("shipment_plans", lambda payload: ShipmentPlan(**payload))
    return next((plan for plan in plans if plan.import_file_number == import_file_number), None)


def _audit_date_for(events: list[dict], import_file_number: str, action: str) -> str | None:
    # events are newest-first; take the most recent matching action for this import.
    for event in events:
        if event.get("entity_id") == import_file_number and event.get("action") == action:
            created_at = event.get("created_at") or ""
            return created_at[:10] or None
    return None


def get_shipment_timeline(import_file_number: str) -> ShipmentTimeline:
    """Assemble the planned-vs-actual lifecycle timeline. Actual dates come from the
    documents (invoice/flight) and the audit log (approve/deliver/receive); planned
    dates come from the saved shipment plan."""
    candidate = get_import_candidate(import_file_number)
    plan = get_shipment_plan(import_file_number)
    events = list_audit_events(limit=500)

    invoice_date = candidate.invoice_date.isoformat() if candidate and candidate.invoice_date else None
    flight_date = candidate.flight_date.isoformat() if candidate and candidate.flight_date else None
    approved = _audit_date_for(events, import_file_number, "approve")
    delivered = _audit_date_for(events, import_file_number, "mark_delivered")
    received = _audit_date_for(events, import_file_number, "post_goods_receipt")

    planned_arrival = plan.planned_arrival_date if plan else None
    planned_delivery = plan.planned_delivery_date if plan else None

    raw_milestones = [
        ("Invoice created", None, invoice_date),
        ("AWB / flight", None, flight_date),
        ("Approved", None, approved),
        ("Delivered", planned_arrival, delivered),
        ("Goods received", planned_delivery, received),
    ]

    milestones: list[ShipmentMilestone] = []
    on_time = late = pending = 0
    for stage, planned, actual in raw_milestones:
        if actual and planned:
            status = "on_time" if actual <= planned else "late"
        elif actual:
            status = "done"
        else:
            status = "pending"
        if status == "on_time":
            on_time += 1
        elif status == "late":
            late += 1
        elif status == "pending":
            pending += 1
        milestones.append(
            ShipmentMilestone(stage=stage, planned_date=planned, actual_date=actual, status=status)
        )

    return ShipmentTimeline(
        import_file_number=import_file_number,
        shipment_name=candidate.shipment_name if candidate else None,
        milestones=milestones,
        on_time_count=on_time,
        late_count=late,
        pending_count=pending,
    )


def ensure_pending_product_master(line: ImportLineCandidate) -> None:
    if get_product(line.item_code):
        return
    create_product(
        CreateProductRequest(
            item_code=line.item_code,
            product_description=line.product_description,
            product_category="Pending Classification",
            uom=line.uom,
        )
    )


def require_document(document_id: str, expected_type: DocumentType):
    record = get_saved_document(document_id)
    if not record:
        raise ValueError(f"Document not found: {document_id}")
    if record.document_type != expected_type:
        expected = expected_type.value.replace("_", " ")
        actual = record.document_type.value.replace("_", " ")
        raise ValueError(f"Expected {expected}, but {record.filename} is {actual}")
    return record


def normalize_document_ids(document_ids: list[str], legacy_document_id: str | None) -> list[str]:
    ordered_ids = [document_id.strip() for document_id in document_ids if document_id.strip()]
    if legacy_document_id and legacy_document_id.strip():
        ordered_ids.append(legacy_document_id.strip())
    return list(dict.fromkeys(ordered_ids))


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def merge_line_maps(line_maps: list[dict[str, dict[str, object]]]) -> tuple[dict[str, dict[str, object]], set[str]]:
    merged: dict[str, dict[str, object]] = {}
    duplicated_item_codes: set[str] = set()
    for line_map in line_maps:
        for item_code, next_line in line_map.items():
            if item_code not in merged:
                merged[item_code] = dict(next_line)
                continue
            duplicated_item_codes.add(item_code)
            current_line = merged[item_code]
            current_line["quantity"] = to_float(current_line.get("quantity")) + to_float(next_line.get("quantity"))
            for field_name, value in next_line.items():
                if field_name == "quantity":
                    continue
                if not current_line.get(field_name) and value:
                    current_line[field_name] = value
    return merged, duplicated_item_codes


def first_header_value(headers: list[dict[str, object]], key: str) -> object | None:
    for header in headers:
        value = header.get(key)
        if value is not None and str(value).strip():
            return value
    return None


def unique_values(values: list[object | None]) -> list[str]:
    return list(
        dict.fromkeys(
            str(value).strip()
            for value in values
            if value is not None and str(value).strip()
        )
    )


def string_or_none(value: object | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def first_value(values: list[str]) -> str | None:
    return values[0] if values else None


def build_shipment_name(
    *,
    country: object,
    vertical: str,
    shipment_number: str,
    fallback_document_id: str,
) -> str:
    country_part = sanitize_name_part(str(country or "Unknown"))
    vertical_part = sanitize_name_part(vertical or "General")
    number_part = sanitize_name_part(shipment_number or fallback_document_id)
    return "-".join(part for part in [country_part, vertical_part, number_part] if part) or fallback_document_id


def sanitize_name_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", value.strip()).strip("-")
    return cleaned.upper() or "UNKNOWN"


def parse_invoice_header(text: str) -> dict[str, object]:
    invoice_number = value_before_label(text, "Invoice No.")
    return {
        "supplier_name": parse_supplier_name(text),
        "invoice_number": invoice_number,
        "invoice_date": parse_invoice_date(text, invoice_number),
        "destination_country": value_before_label(text, "Final Destination"),
        "origin_country": value_before_label(text, "Country Of Origin"),
        "currency": value_before_label(text, "Currency"),
        "destination_entity": first_business_name_after(text, "CONSIGNEE"),
        "awb_number": first_match(text, r"\b(\d{3}-\d{7,9})\b"),
        "package_count": parse_int(value_after_label(text, "No Of Packages")),
        "gross_weight_kg": parse_float_after_label(text, "Gross Wt."),
    }


def parse_packing_header(text: str) -> dict[str, object]:
    return {
        "invoice_number": first_match(text, r"Packing List:\s*DATE\s*\d{2}\.\d{2}\.\d{4}\s*(\d{6,})"),
        "invoice_date": parse_date(first_match(text, r"Packing List:\s*DATE\s*(\d{2}\.\d{2}\.\d{4})")),
        "destination_country": first_match(text, r"Country of Final Destination:\s*([A-Za-z ]+)"),
        "origin_country": first_match(text, r"Country of Origin of Goods:\s*([A-Za-z ]+)"),
        "destination_entity": first_business_name_after(text, "SHIP TO"),
        "package_count": None,
        "gross_weight_kg": parse_float_after_label(text, "Gross Weight"),
    }


def parse_supplier_name(text: str) -> str | None:
    lines = clean_lines(text)
    for line in lines[:12]:
        if "MERIL" in line.upper() and ("LIFE" in line.upper() or "SCIENCE" in line.upper()):
            return clean_value(line)
    return None


def parse_awb_header(text: str) -> dict[str, object]:
    awb_number = first_match(text, r"\b(\d{3}-\d{7,9})\b")
    carrier_name = first_match(text, r"\b(Lufthansa Cargo[^\n]*)", flags=re.IGNORECASE)
    flight_number = normalize_flight_number(
        first_match(text, r"\b([A-Z][A-Za-z]\d{3,5})\b"),
        carrier_name,
    )
    return {
        "awb_number": awb_number,
        "shipper_name": parse_awb_party_name(text, "Shipper"),
        "consignee_name": parse_awb_party_name(text, "Consignee"),
        "carrier_name": carrier_name,
        "flight_number": flight_number,
        "flight_date": parse_awb_flight_date(text, flight_number),
        "origin_airport": parse_awb_origin_airport(text),
        "destination_airport": parse_awb_destination_airport(text),
        "package_count": parse_awb_package_count(text),
        "gross_weight_kg": parse_awb_gross_weight(text),
        "chargeable_weight_kg": parse_awb_chargeable_weight(text),
    }


def parse_invoice_lines(text: str) -> dict[str, dict[str, object]]:
    lines = clean_lines(text)
    parsed: dict[str, dict[str, object]] = {}
    index = 0
    while index < len(lines) - 7:
        if (
            re.fullmatch(r"\d{1,3}", lines[index])
            and re.fullmatch(r"\d{6,10}", lines[index + 1])
            and is_item_code(lines[index + 2])
        ):
            row_number = int(lines[index])
            hs_code = lines[index + 1]
            item_code = lines[index + 2]
            cursor = index + 3
            description_parts: list[str] = []
            while cursor < len(lines) and not re.fullmatch(r"\d+(?:\.\d+)?", lines[cursor]):
                description_parts.append(lines[cursor])
                cursor += 1
            if cursor + 3 >= len(lines):
                index += 1
                continue
            parsed[item_code] = {
                "line_number": row_number,
                "hs_code": hs_code,
                "product_description": " ".join(description_parts).strip(),
                "quantity": to_float(lines[cursor]),
                "uom": lines[cursor + 1],
                "unit_value": to_float(lines[cursor + 2]),
                "line_value": to_float(lines[cursor + 3]),
            }
            index = cursor + 4
            continue
        index += 1
    return parsed


def parse_packing_lines(text: str) -> dict[str, dict[str, object]]:
    lines = clean_lines(text)
    parsed: dict[str, dict[str, object]] = {}
    index = 0
    while index < len(lines) - 6:
        if not (
            re.fullmatch(r"\d{1,3}", lines[index])
            and index + 3 < len(lines)
            and is_item_code(lines[index + 3])
        ):
            index += 1
            continue

        item_code = lines[index + 3]
        body_start = index + 4

        # A packing-list row has the shape:
        #   <description...> <batch> [serial] <expiry date> <qty> <weight>
        # The expiry date is the most reliable anchor, so find it first, then read
        # batch (+ optional serial) backwards and quantity/weight forwards. This
        # handles serialised devices (valves) where a serial sits between the
        # batch and the date, which the old "batch immediately before date" rule
        # could not.
        date_index = None
        for offset in range(body_start, min(body_start + 14, len(lines) - 2)):
            if parse_date(lines[offset]) is not None:
                date_index = offset
                break
        if date_index is None or date_index + 2 >= len(lines):
            index += 1
            continue

        codes: list[str] = []
        scan = date_index - 1
        while scan >= body_start and len(codes) < 2 and _is_code_token(lines[scan]):
            codes.insert(0, lines[scan])
            scan -= 1
        if not codes:
            index += 1
            continue

        batch_number = codes[0]
        serial_number = codes[1] if len(codes) > 1 else None
        description_parts = lines[body_start : scan + 1]

        parsed[packing_line_key(item_code, batch_number, serial_number)] = {
            "item_code": item_code,
            "product_description": " ".join(description_parts).strip(),
            "batch_number": batch_number,
            "serial_number": serial_number,
            "expiry_date": parse_date(lines[date_index]),
            "quantity": to_float(lines[date_index + 1]),
            "weight_kg": to_float(lines[date_index + 2]),
        }
        index = date_index + 3
    return parsed


def _is_code_token(value: str) -> bool:
    """True for a batch/serial token: one word (no spaces) of letters/digits,
    at least 4 characters, containing at least one digit. Description words
    (which contain spaces, commas, or no digits) are excluded."""
    token = value.strip()
    if " " in token or len(token) < 4:
        return False
    if not re.fullmatch(r"[A-Za-z0-9/-]+", token):
        return False
    return any(character.isdigit() for character in token)


def packing_line_key(item_code: str, batch_number: str, serial_number: str | None = None) -> str:
    """Key a packing-list row by item + batch (+ serial when present) so different
    batches or serialised units of the same device stay separate and traceable."""
    parts = [item_code, (batch_number or "").strip()]
    if serial_number and serial_number.strip():
        parts.append(serial_number.strip())
    return " / ".join(part for part in parts if part)


# markitdown (Microsoft) renders each line item as a single horizontal row, which
# is more robust than PyMuPDF's vertical tokens for multi-page / wrapped layouts.
# These parsers read that horizontal form; the caller keeps whichever extractor
# recovers MORE line items, so markitdown can only help, never regress.
_INVOICE_MD_ROW = re.compile(
    r"^\s*(\d{1,3})\s+(\d{6,10})\s+([A-Z0-9][A-Z0-9/-]{2,})\s+(.+?)\s+"
    r"(\d+(?:\.\d+)?)\s+([A-Za-z]{1,5})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$"
)


def parse_invoice_lines_markdown(text: str) -> dict[str, dict[str, object]]:
    """Parse invoice line items from markitdown's clean horizontal rows. Invoices
    have fixed columns (row, HS, item, description, qty, UOM, rate, amount), which
    regex reliably; this helps multi-page invoices. Packing lists are NOT parsed
    this way because their variable descriptions fool a horizontal regex - the
    date-anchored vertical parser is more reliable there."""
    parsed: dict[str, dict[str, object]] = {}
    for raw in text.splitlines():
        match = _INVOICE_MD_ROW.match(raw.strip())
        if not match:
            continue
        row_number, hs_code, item_code, description, quantity, uom, unit_value, line_value = match.groups()
        parsed[item_code] = {
            "line_number": int(row_number),
            "hs_code": hs_code,
            "product_description": description.strip(),
            "quantity": to_float(quantity),
            "uom": uom,
            "unit_value": to_float(unit_value),
            "line_value": to_float(line_value),
        }
    return parsed


def clean_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def value_before_label(text: str, label: str) -> str | None:
    pattern = re.compile(r":\s*(?P<value>[^\n:]+?)\s*\n\s*" + re.escape(label), re.IGNORECASE)
    matches = [clean_value(match.group("value")) for match in pattern.finditer(text)]
    return matches[-1] if matches else None


def value_after_label(text: str, label: str) -> str | None:
    pattern = re.compile(re.escape(label) + r"\s*:?\s*(?P<value>[^\n:]+)", re.IGNORECASE)
    match = pattern.search(text)
    return clean_value(match.group("value")) if match else None


def first_match(text: str, pattern: str, flags: int = 0) -> str | None:
    match = re.search(pattern, text, flags | re.IGNORECASE | re.MULTILINE | re.DOTALL)
    return clean_value(match.group(1)) if match else None


def first_business_name_after(text: str, marker: str) -> str | None:
    lines = clean_lines(text)
    for index, line in enumerate(lines):
        if marker.lower() in line.lower():
            for candidate in lines[index + 1 : index + 8]:
                clean_candidate = clean_value(candidate.lstrip(":"))
                if (
                    clean_candidate
                    and not clean_candidate.isdigit()
                    and not clean_candidate.lower().startswith(("phone", "e-mail", "email", "contact"))
                ):
                    return clean_candidate
    return None


def parse_invoice_date(text: str, invoice_number: str | None) -> date | None:
    if not invoice_number:
        return None
    pattern = re.compile(
        r":\s*(\d{2}\.\d{2}\.\d{4})\s*\n\s*Date\s*\n\s*:\s*"
        + re.escape(invoice_number)
        + r"\s*\n\s*Invoice No\.",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    return parse_date(match.group(1)) if match else None


def parse_float_after_label(text: str, label: str) -> float | None:
    return to_float(value_after_label(text, label))


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    match = re.search(r"(\d{2})[./-](\d{2})[./-](\d{4})", value)
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_awb_flight_date(text: str, flight_number: str | None) -> date | None:
    if flight_number:
        flight_pattern = re.escape(flight_number)
        if flight_number.startswith("LH"):
            flight_pattern = r"L[HhUu]" + re.escape(flight_number[2:])
        match = re.search(
            flight_pattern + r".{0,120}?(\d{2}[./-]\d{2}[./-]\d{4})",
            text,
            re.IGNORECASE | re.DOTALL,
        )
        if match:
            return parse_date(match.group(1))
    return parse_date(first_match(text, r"\b(\d{2}[./-]\d{2}[./-]\d{4})\b"))


def parse_awb_chargeable_weight(text: str) -> float | None:
    match = re.search(
        r"\n\s*\d+\s+\d+(?:\.\d+)?\s*\w+\s+\w\s+(?P<weight>\d+(?:\.\d+)?)\b",
        text,
        re.IGNORECASE,
    )
    if not match:
        return parse_float_after_label(text, "Chargeable Weight")

    parsed = to_float(match.group("weight"))
    if parsed is not None and parsed >= 10:
        return parsed / 10
    return parsed


def parse_awb_origin_airport(text: str) -> str | None:
    match = re.search(
        r"Airport of Departure.*?\n\s*(?P<origin>[A-Z][A-Z -]+?)(?:\s+CONTACT|\n)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    return clean_value(match.group("origin")) if match else None


def parse_awb_destination_airport(text: str) -> str | None:
    match = re.search(
        r"Airport of Destination[^\n]*\n\s*(?P<destination>[A-Z][A-Z -]+)",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None
    destination = re.split(
        r"\s+(?:L[HhUu]\d+|conditions|Incicate|amount)\b",
        match.group("destination"),
        maxsplit=1,
    )[0]
    destination = re.sub(r"\s+L[HhUu]?$", "", destination)
    return clean_value(destination)


def parse_awb_party_name(text: str, marker: str) -> str | None:
    lines = clean_lines(text)
    marker_lower = marker.lower()
    for index, line in enumerate(lines):
        normalized_line = line.lower()
        if marker_lower not in normalized_line or "name" not in normalized_line:
            continue
        for candidate in lines[index + 1 : index + 12]:
            clean_candidate = clean_value(candidate.strip("[]()|"))
            if not clean_candidate:
                continue
            candidate_lower = clean_candidate.lower()
            if any(
                blocked in candidate_lower
                for blocked in (
                    "account number",
                    "not negotiable",
                    "airway bill",
                    "issued by",
                    "copies",
                )
            ):
                continue
            if clean_candidate.isdigit() or len(clean_candidate) < 4:
                continue
            if marker_lower == "shipper" and "meril" not in candidate_lower:
                continue
            return clean_candidate
    return None


def parse_awb_piece_weight_line(text: str) -> tuple[int | None, float | None]:
    match = re.search(
        r"\n\s*(?P<pieces>\d+)\s+(?P<weight>\d+(?:[.,]\d+)?)\s*[kK]",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None, None

    pieces = parse_int(match.group("pieces"))
    weight = to_float(match.group("weight"))
    if weight is not None and weight >= 10:
        weight = weight / 10
    return pieces, weight


def parse_awb_package_count(text: str) -> int | None:
    pieces, _weight = parse_awb_piece_weight_line(text)
    return pieces


def parse_awb_gross_weight(text: str) -> float | None:
    _pieces, weight = parse_awb_piece_weight_line(text)
    return weight


def normalize_flight_number(value: str | None, carrier_name: str | None) -> str | None:
    if not value:
        return None
    normalized = value.upper()
    if carrier_name and "lufthansa" in carrier_name.lower() and normalized.startswith("LU"):
        return f"LH{normalized[2:]}"
    return normalized


def to_float(value: object) -> float | None:
    if value is None:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", str(value).replace(",", ""))
    return float(match.group(0)) if match else None


def parse_int(value: str | None) -> int | None:
    parsed = to_float(value)
    return int(parsed) if parsed is not None else None


def is_item_code(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]{2,}[A-Z0-9/-]{3,}", value.strip()))


def is_batch_number(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]{2,}[A-Z0-9/-]{3,}", value.strip()))


def clean_value(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip(" :-")
    return cleaned or None


def build_import_file_number(
    destination_country: str | None,
    invoice_number: str | None,
    fallback_document_id: str,
) -> str:
    country_prefix = re.sub(r"[^A-Z]", "", (destination_country or "XX").upper())[:2] or "XX"
    reference = invoice_number or fallback_document_id.replace("DOC-", "")
    return f"IMP-{country_prefix}-{reference}"


def exp_0361_development_fixture() -> ImportFileCandidate:
    # Temporary fixture from the user's uploaded test document set.
    # Production import candidates must be generated from uploaded documents and learned masters.
    raw_lines = [
        ("MOZS20030", "MOZECSEB PTCA BALLOON CATHETER, 2.00X30MM", "MOZSAB24", date(2028, 4, 23)),
        ("MOZS22530", "MOZECSEB PTCA BALLOON CATHETER, 2.25X30MM", "MOZSAB04", date(2028, 1, 27)),
        ("MOZS35020", "MOZECSEB PTCA BALLOON CATHETER, 3.50X20MM", "MOZSAB03", date(2028, 1, 13)),
        ("MOZS35017", "MOZECSEB PTCA BALLOON CATHETER, 3.50X17MM", "MOZSAB21", date(2028, 4, 10)),
        ("MOZS35014", "MOZECSEB PTCA BALLOON CATHETER, 3.50X14MM", "MOZSAB21", date(2028, 4, 10)),
        ("MOZS25030", "MOZECSEB PTCA BALLOON CATHETER, 2.50X30MM", "MOZSAB27", date(2028, 5, 9)),
        ("MOZS22525", "MOZECSEB PTCA BALLOON CATHETER, 2.25X25MM", "MOZSAB04", date(2028, 1, 27)),
    ]

    lines: list[ImportLineCandidate] = []
    for item_code, description, batch_number, expiry_date in raw_lines:
        profile_response = get_product_learning_profile(item_code)
        lines.append(
            ImportLineCandidate(
                item_code=item_code,
                product_description=description,
                batch_number=batch_number,
                expiry_date=expiry_date,
                quantity=1,
                uom=profile_response.profile.uom if profile_response.profile else "EA",
                unit_value=71,
                currency="EUR",
                product_profile_status="known" if profile_response.is_known else "first_time_questions_required",
            )
        )

    return ImportFileCandidate(
        import_file_number="ITALY-CARDIO-2926200361",
        shipment_name="ITALY-CARDIO-2926200361",
        shipment_vertical="Cardio",
        shipment_number="2926200361",
        destination_entity="Meril Italy S.R.L.",
        destination_country="Italy",
        status=ImportStatus.VALIDATION_PENDING,
        invoice_number="2926200361",
        invoice_date=date(2026, 5, 29),
        awb_number="020-04683840",
        origin_country="India",
        carrier_name="Lufthansa Cargo AG Ltd",
        flight_number="LH8023",
        flight_date=date(2026, 5, 31),
        package_count=1,
        gross_weight_kg=2.420,
        chargeable_weight_kg=2.5,
        lines=lines,
        invoice_numbers=["2926200361"],
    )
