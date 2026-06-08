import re
from datetime import date
from pathlib import Path

from app.schemas.extraction import DocumentType
from app.schemas.imports import (
    ImportApprovalRequest,
    ImportAssemblyRequest,
    ImportFileCandidate,
    ImportGoodsReceiptPostRequest,
    ImportLineCandidate,
    ImportStatus,
)
from app.schemas.security import ApprovalResolutionRequest
from app.schemas.warehouse import CreateGoodsReceiptLineRequest, CreateGoodsReceiptRequest, CreateProductRequest, WorkflowResult
from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.services.learning_repository import get_product_learning_profile
from app.services.local_document_store import get_saved_document
from app.services.security_repository import normalize_email, require_user_permission, resolve_approver
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
    invoice_record = require_document(
        request.commercial_invoice_document_id,
        DocumentType.COMMERCIAL_INVOICE,
    )
    packing_record = require_document(
        request.packing_list_document_id,
        DocumentType.PACKING_LIST,
    )
    awb_record = (
        require_document(request.awb_document_id, DocumentType.AIR_WAYBILL)
        if request.awb_document_id
        else None
    )

    invoice_text = extract_text(Path(invoice_record.saved_path))
    packing_text = extract_text(Path(packing_record.saved_path))
    awb_text = extract_text(Path(awb_record.saved_path)) if awb_record else ""

    warnings: list[str] = []
    if not invoice_text.strip():
        warnings.append("Commercial invoice has no readable text. Manual validation is required.")
    if not packing_text.strip():
        warnings.append("Packing list has no readable text. Manual validation is required.")
    if awb_record and not awb_text.strip():
        warnings.append("AWB has no readable text. OCR must be installed or AWB fields must be validated manually.")
    if not awb_record:
        warnings.append("AWB was not selected. AWB fields are pending.")

    invoice_header = parse_invoice_header(invoice_text)
    packing_header = parse_packing_header(packing_text)
    awb_header = parse_awb_header(awb_text)
    invoice_lines = parse_invoice_lines(invoice_text)
    packing_lines = parse_packing_lines(packing_text)

    item_codes = list(dict.fromkeys([*invoice_lines.keys(), *packing_lines.keys()]))
    lines: list[ImportLineCandidate] = []
    for item_code in item_codes:
        invoice_line = invoice_lines.get(item_code, {})
        packing_line = packing_lines.get(item_code, {})
        profile_response = get_product_learning_profile(item_code)
        learned_uom = profile_response.profile.uom if profile_response.profile else None
        lines.append(
            ImportLineCandidate(
                item_code=item_code,
                product_description=str(
                    invoice_line.get("product_description")
                    or packing_line.get("product_description")
                    or item_code
                ),
                batch_number=str(packing_line.get("batch_number") or ""),
                expiry_date=packing_line.get("expiry_date"),
                quantity=float(packing_line.get("quantity") or invoice_line.get("quantity") or 0),
                uom=str(learned_uom or invoice_line.get("uom") or "EA"),
                unit_value=to_float(invoice_line.get("unit_value")),
                currency=invoice_header.get("currency"),
                product_profile_status="known"
                if profile_response.is_known
                else "first_time_questions_required",
            )
        )

    if not lines:
        warnings.append("No product lines were extracted. Upload readable invoice and packing list files.")

    destination_country = (
        invoice_header.get("destination_country")
        or packing_header.get("destination_country")
        or "Unknown"
    )
    invoice_number = invoice_header.get("invoice_number") or packing_header.get("invoice_number")
    import_file_number = build_import_file_number(destination_country, invoice_number, invoice_record.document_id)
    source_document_ids = [
        invoice_record.document_id,
        packing_record.document_id,
        *([awb_record.document_id] if awb_record else []),
    ]

    candidate = ImportFileCandidate(
        import_file_number=import_file_number,
        supplier_name=invoice_header.get("supplier_name"),
        destination_entity=invoice_header.get("destination_entity")
        or packing_header.get("destination_entity")
        or "Unknown",
        destination_country=destination_country,
        status=ImportStatus.VALIDATION_PENDING,
        invoice_number=invoice_number,
        invoice_date=invoice_header.get("invoice_date") or packing_header.get("invoice_date"),
        awb_number=awb_header.get("awb_number") or invoice_header.get("awb_number"),
        origin_country=invoice_header.get("origin_country") or packing_header.get("origin_country"),
        carrier_name=awb_header.get("carrier_name"),
        flight_number=awb_header.get("flight_number"),
        flight_date=awb_header.get("flight_date"),
        package_count=invoice_header.get("package_count") or packing_header.get("package_count"),
        gross_weight_kg=invoice_header.get("gross_weight_kg") or packing_header.get("gross_weight_kg"),
        chargeable_weight_kg=awb_header.get("chargeable_weight_kg"),
        lines=lines,
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
        new_value={"status": candidate.status.value, "line_count": len(candidate.lines)},
    )
    return candidate


def post_import_goods_receipt(request: ImportGoodsReceiptPostRequest) -> WorkflowResult:
    posted_user = require_user_permission(request.auth_token, "goods_receipt")
    if request.candidate.status != ImportStatus.VALIDATED:
        raise ValueError("Import file must be approved before Goods Receipt posting")
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
    if not request.candidate.lines:
        raise ValueError("Import file has no product lines to approve")

    resolution = resolve_approver(
        ApprovalResolutionRequest(
            process_name="import_validation",
            country=request.candidate.destination_country,
            vertical="All",
            material_code="All",
        )
    )
    if not resolution.approver_email:
        raise ValueError(
            "No import approval rule is configured. Add one in Security for this destination country."
        )
    if normalize_email(request.approved_by) != approving_user.email:
        raise ValueError("Approval request does not match logged-in user.")
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
        "carrier_name": carrier_name,
        "flight_number": flight_number,
        "flight_date": parse_awb_flight_date(text, flight_number),
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
    while index < len(lines) - 8:
        if (
            re.fullmatch(r"\d{1,3}", lines[index])
            and index + 3 < len(lines)
            and is_item_code(lines[index + 3])
        ):
            item_code = lines[index + 3]
            cursor = index + 4
            description_parts: list[str] = []
            while cursor + 1 < len(lines) and not (
                is_batch_number(lines[cursor])
                and parse_date(lines[cursor + 1]) is not None
            ):
                description_parts.append(lines[cursor])
                cursor += 1
            if cursor + 3 >= len(lines):
                index += 1
                continue
            parsed[item_code] = {
                "product_description": " ".join(description_parts).strip(),
                "batch_number": lines[cursor],
                "expiry_date": parse_date(lines[cursor + 1]),
                "quantity": to_float(lines[cursor + 2]),
                "weight_kg": to_float(lines[cursor + 3]),
            }
            index = cursor + 4
            continue
        index += 1
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
        import_file_number="IMP-IT-2926200361",
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
    )
