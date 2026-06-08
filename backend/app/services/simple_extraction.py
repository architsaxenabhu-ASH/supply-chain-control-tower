from __future__ import annotations

import csv
import io
import json
import re
from datetime import date
from pathlib import Path

from app.schemas.extraction import DocumentType, ExtractedField, ValidationStatus


def extract_fields_from_file(
    document_id: str,
    file_path: Path,
    document_type: DocumentType,
    expected_fields: list[str],
) -> list[ExtractedField]:
    text = extract_text(file_path)
    structured_values = extract_structured_values(text, document_type)
    calculated_values = calculate_document_values(structured_values)
    all_values = {**structured_values, **calculated_values}
    field_names = [
        *expected_fields,
        *[
            field_name
            for field_name in all_values
            if field_name not in expected_fields
        ],
    ]

    extracted_fields: list[ExtractedField] = []
    for field_name in field_names:
        structured_value = all_values.get(field_name)
        field_value = stringify_value(structured_value) or find_field_value(text, field_name)
        if not is_plausible_field_value(field_name, field_value):
            field_value = None
        extracted_fields.append(
            ExtractedField(
                document_id=document_id,
                field_name=field_name,
                extracted_value=field_value,
                confidence_score=confidence_for_value(field_value, field_name, structured_values),
                validation_status=ValidationStatus.PENDING,
                source_engine=source_engine_for_value(field_value, field_name, document_type, structured_values),
            )
        )
    return extracted_fields


def extract_structured_values(text: str, document_type: DocumentType) -> dict[str, object]:
    if not text.strip():
        return {}

    if document_type == DocumentType.COMMERCIAL_INVOICE:
        return extract_invoice_values(text)
    if document_type == DocumentType.PACKING_LIST:
        return extract_packing_list_values(text)
    if document_type == DocumentType.AIR_WAYBILL:
        return extract_awb_values(text)
    return {}


def extract_invoice_values(text: str) -> dict[str, object]:
    parsers = load_import_parsers()
    header = parsers["parse_invoice_header"](text)
    lines = parsers["parse_invoice_lines"](text)
    first_line = first_line_item(lines)
    line_summary = summarize_line_items(lines)

    values: dict[str, object] = {
        "Invoice Number": header.get("invoice_number"),
        "Invoice Date": header.get("invoice_date"),
        "Currency": header.get("currency"),
        "Country of Origin": header.get("origin_country"),
        "Country of Export": header.get("origin_country"),
        "Country of Import": header.get("destination_country"),
        "Supplier Name": header.get("supplier_name"),
        "Customer Name": header.get("destination_entity"),
        "AWB Number": header.get("awb_number"),
        "Shipment Date": header.get("invoice_date"),
        "Product Code": first_line.get("item_code"),
        "Product Name": first_line.get("product_description"),
        "SKU": first_line.get("item_code"),
        "Part Number": first_line.get("item_code"),
        "Quantity": line_summary.get("total_quantity"),
        "UOM": first_line.get("uom"),
        "Unit Price": first_line.get("unit_value"),
        "Line Value": first_line.get("line_value"),
        "Invoice Value": line_summary.get("total_line_value"),
        "Net Value": line_summary.get("total_line_value"),
        "Gross Value": line_summary.get("total_line_value"),
        "Number Of Packages": header.get("package_count"),
        "Gross Weight": header.get("gross_weight_kg"),
        "Line Item Count": line_summary.get("line_count"),
        "Item Codes Detected": line_summary.get("item_codes"),
        "Total Quantity": line_summary.get("total_quantity"),
        "Total Line Value": line_summary.get("total_line_value"),
        "Line Items JSON": build_line_items_json(lines),
    }
    return remove_empty_values(values)


def extract_packing_list_values(text: str) -> dict[str, object]:
    parsers = load_import_parsers()
    header = parsers["parse_packing_header"](text)
    lines = parsers["parse_packing_lines"](text)
    first_line = first_line_item(lines)
    line_summary = summarize_line_items(lines)
    earliest_expiry = earliest_date(
        line.get("expiry_date")
        for line in lines.values()
        if isinstance(line, dict)
    )

    values: dict[str, object] = {
        "Packing List Number": header.get("invoice_number"),
        "Packing List Date": header.get("invoice_date"),
        "Invoice Number": header.get("invoice_number"),
        "Product Code": first_line.get("item_code"),
        "Product Name": first_line.get("product_description"),
        "SKU": first_line.get("item_code"),
        "Part Number": first_line.get("item_code"),
        "Batch Number": first_line.get("batch_number"),
        "Lot Number": first_line.get("batch_number"),
        "Quantity": line_summary.get("total_quantity"),
        "UOM": "EA" if lines else None,
        "Gross Weight": header.get("gross_weight_kg"),
        "Expiry Date": earliest_expiry,
        "Country of Origin": header.get("origin_country"),
        "Country of Import": header.get("destination_country"),
        "Customer Name": header.get("destination_entity"),
        "Line Item Count": line_summary.get("line_count"),
        "Item Codes Detected": line_summary.get("item_codes"),
        "Batch Numbers Detected": line_summary.get("batch_numbers"),
        "Total Quantity": line_summary.get("total_quantity"),
        "Earliest Expiry Date": earliest_expiry,
        "Line Items JSON": build_line_items_json(lines),
    }
    return remove_empty_values(values)


def extract_awb_values(text: str) -> dict[str, object]:
    parsers = load_import_parsers()
    header = parsers["parse_awb_header"](text)

    values: dict[str, object] = {
        "AWB Number": header.get("awb_number"),
        "MAWB Number": header.get("awb_number"),
        "Issue Date": header.get("flight_date"),
        "Shipment Date": header.get("flight_date"),
        "Shipper Name": header.get("shipper_name"),
        "Consignee Name": header.get("consignee_name"),
        "Carrier Name": header.get("carrier_name"),
        "Flight Number": header.get("flight_number"),
        "Origin Airport": header.get("origin_airport"),
        "Destination Airport": header.get("destination_airport"),
        "Number Of Packages": header.get("package_count"),
        "Gross Weight": header.get("gross_weight_kg"),
        "Chargeable Weight": header.get("chargeable_weight_kg"),
        "Tracking Number": header.get("awb_number"),
    }
    return remove_empty_values(values)


def load_import_parsers() -> dict[str, object]:
    # Imported lazily to avoid a module-level circular import: import_repository also uses extract_text.
    from app.services import import_repository

    return {
        "parse_awb_header": import_repository.parse_awb_header,
        "parse_invoice_header": import_repository.parse_invoice_header,
        "parse_invoice_lines": import_repository.parse_invoice_lines,
        "parse_packing_header": import_repository.parse_packing_header,
        "parse_packing_lines": import_repository.parse_packing_lines,
    }


def first_line_item(lines: dict[str, dict[str, object]]) -> dict[str, object]:
    if not lines:
        return {}
    item_code, payload = next(iter(lines.items()))
    return {"item_code": item_code, **payload}


def summarize_line_items(lines: dict[str, dict[str, object]]) -> dict[str, object]:
    total_quantity = sum(
        float(line.get("quantity") or 0)
        for line in lines.values()
    )
    total_line_value = sum(
        float(line.get("line_value") or 0)
        for line in lines.values()
    )
    batch_numbers = [
        str(line.get("batch_number"))
        for line in lines.values()
        if line.get("batch_number")
    ]
    return {
        "line_count": len(lines),
        "item_codes": ", ".join(lines.keys()) if lines else None,
        "batch_numbers": ", ".join(dict.fromkeys(batch_numbers)) if batch_numbers else None,
        "total_quantity": total_quantity if lines else None,
        "total_line_value": total_line_value if total_line_value else None,
    }


def build_line_items_json(lines: dict[str, dict[str, object]]) -> str | None:
    if not lines:
        return None
    payload = []
    for item_code, line in lines.items():
        payload.append(
            {
                "item_code": item_code,
                "product_description": stringify_value(line.get("product_description")),
                "batch_number": stringify_value(line.get("batch_number")),
                "expiry_date": stringify_value(line.get("expiry_date")),
                "quantity": line.get("quantity"),
                "uom": line.get("uom") or "EA",
                "unit_value": line.get("unit_value"),
                "line_value": line.get("line_value"),
            }
        )
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)


def calculate_document_values(values: dict[str, object]) -> dict[str, object]:
    calculated: dict[str, object] = {}
    expiry = parse_extracted_date(values.get("Expiry Date") or values.get("Earliest Expiry Date"))
    if expiry:
        days_to_expiry = (expiry - date.today()).days
        calculated["Days to Expiry"] = days_to_expiry
        calculated["Shelf Life"] = f"{days_to_expiry} days remaining"
        calculated["Expiry Bucket"] = expiry_bucket(days_to_expiry)
    return calculated


def parse_extracted_date(value: object) -> date | None:
    if isinstance(value, date):
        return value
    parsed = stringify_value(value)
    if not parsed:
        return None
    for pattern in (
        r"(\d{4})-(\d{2})-(\d{2})",
        r"(\d{2})[./-](\d{2})[./-](\d{4})",
    ):
        match = re.search(pattern, parsed)
        if not match:
            continue
        parts = [int(part) for part in match.groups()]
        try:
            if len(parts[0:1]) and parts[0] > 1900:
                return date(parts[0], parts[1], parts[2])
            return date(parts[2], parts[1], parts[0])
        except ValueError:
            return None
    return None


def earliest_date(values) -> date | None:
    parsed_dates = [
        parsed
        for parsed in (parse_extracted_date(value) for value in values)
        if parsed
    ]
    return min(parsed_dates) if parsed_dates else None


def expiry_bucket(days_to_expiry: int) -> str:
    if days_to_expiry <= 90:
        return "0-90 Days"
    if days_to_expiry <= 180:
        return "91-180 Days"
    if days_to_expiry <= 365:
        return "181-365 Days"
    return "Above 365 Days"


def remove_empty_values(values: dict[str, object]) -> dict[str, object]:
    return {
        key: value
        for key, value in values.items()
        if stringify_value(value)
    }


def stringify_value(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float):
        return f"{value:g}"
    text = str(value).strip()
    return text or None


def is_plausible_field_value(field_name: str, value: str | None) -> bool:
    if not value:
        return True

    if field_name in {"AWB Number", "MAWB Number", "HAWB Number", "Tracking Number"}:
        return bool(re.search(r"\b\d{3}-?\d{7,9}\b", value))
    if field_name == "Currency":
        return bool(re.fullmatch(r"[A-Z]{3}", value.strip()))
    if field_name in {"Quantity", "Unit Price", "Line Value", "Invoice Value", "Net Value", "Gross Value"}:
        return bool(re.search(r"\d", value))
    return True


def confidence_for_value(
    field_value: str | None,
    field_name: str,
    structured_values: dict[str, object],
) -> float | None:
    if not field_value:
        return None
    if field_name in structured_values:
        return 0.88
    return 0.64


def source_engine_for_value(
    field_value: str | None,
    field_name: str,
    document_type: DocumentType,
    structured_values: dict[str, object],
) -> str | None:
    if not field_value:
        return None
    if field_name in structured_values:
        return f"phase_2_structured_extractor:{document_type.value}"
    return f"phase_1_rule_extractor:{document_type.value}"


def extract_text(file_path: Path) -> str:
    extension = file_path.suffix.lower()
    if extension == ".csv":
        return extract_csv_text(file_path)
    if extension in {".xlsx", ".xls"}:
        return extract_excel_text(file_path)
    if extension == ".pdf":
        return extract_pdf_text(file_path)
    if extension in {".jpg", ".jpeg", ".png"}:
        return extract_image_text(file_path)
    return extract_plain_text(file_path)


def extract_plain_text(file_path: Path) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return file_path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return ""


def extract_csv_text(file_path: Path) -> str:
    rows: list[str] = []
    with file_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.reader(csv_file)
        for row in reader:
            rows.append(" | ".join(row))
    return "\n".join(rows)


def extract_excel_text(file_path: Path) -> str:
    try:
        import openpyxl
    except ImportError:
        return ""

    workbook = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    lines: list[str] = []
    for sheet in workbook.worksheets:
        lines.append(sheet.title)
        for row in sheet.iter_rows(values_only=True):
            values = [str(value) for value in row if value is not None]
            if values:
                lines.append(" | ".join(values))
    return "\n".join(lines)


def extract_pdf_text(file_path: Path) -> str:
    try:
        import fitz
    except ImportError:
        return extract_pdf_text_with_pypdf(file_path)

    text_parts: list[str] = []
    with fitz.open(file_path) as pdf:
        for page in pdf:
            text_parts.append(page.get_text())
        text = "\n".join(text_parts)
        if text.strip():
            return text
        return extract_pdf_ocr_text_with_fitz(pdf)


def extract_pdf_text_with_pypdf(file_path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    reader = PdfReader(str(file_path))
    text_parts: list[str] = []
    for page in reader.pages:
        text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts)


def extract_image_text(file_path: Path) -> str:
    ocr = get_tesseract()
    if ocr is None:
        return ""

    try:
        from PIL import Image
    except ImportError:
        return ""

    return ocr.image_to_string(Image.open(file_path))


def extract_pdf_ocr_text_with_fitz(pdf) -> str:
    ocr = get_tesseract()
    if ocr is None:
        return ""

    try:
        import fitz
        from PIL import Image
    except ImportError:
        return ""

    text_parts: list[str] = []
    matrix = fitz.Matrix(2, 2)
    for page in pdf:
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        image = Image.open(io.BytesIO(pixmap.tobytes("png")))
        text_parts.append(ocr.image_to_string(image))
    return "\n".join(text_parts)


def get_tesseract():
    try:
        import pytesseract
    except ImportError:
        return None

    default_windows_path = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    if default_windows_path.exists():
        pytesseract.pytesseract.tesseract_cmd = str(default_windows_path)
    return pytesseract


def find_field_value(text: str, field_name: str) -> str | None:
    if not text:
        return None

    label_variants = build_label_variants(field_name)
    for label in label_variants:
        pattern = re.compile(
            rf"(?im)^\s*{re.escape(label)}\s*(?:[:#-]|\|)\s*(?P<value>.+?)\s*$"
        )
        match = pattern.search(text)
        if match:
            value = match.group("value").strip()
            return value or None

    return None


def build_label_variants(field_name: str) -> list[str]:
    variants = {field_name}

    if field_name.endswith("Number"):
        variants.add(field_name.replace("Number", "No"))
        variants.add(field_name.replace("Number", "No."))
    if "AWB" in field_name:
        variants.add(field_name.replace("AWB", "Air Waybill"))
    if "BOL" in field_name:
        variants.add(field_name.replace("BOL", "Bill of Lading"))
    if "BOE" in field_name:
        variants.add(field_name.replace("BOE", "Bill of Entry"))

    return sorted(variants, key=len, reverse=True)
