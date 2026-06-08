from __future__ import annotations

import csv
import io
import re
from pathlib import Path

from app.schemas.extraction import DocumentType, ExtractedField, ValidationStatus


def extract_fields_from_file(
    document_id: str,
    file_path: Path,
    document_type: DocumentType,
    expected_fields: list[str],
) -> list[ExtractedField]:
    text = extract_text(file_path)
    extracted_fields: list[ExtractedField] = []
    for field_name in expected_fields:
        field_value = find_field_value(text, field_name)
        extracted_fields.append(
            ExtractedField(
            document_id=document_id,
            field_name=field_name,
            extracted_value=field_value,
            confidence_score=0.72 if field_value else None,
            validation_status=ValidationStatus.PENDING,
            source_engine=f"phase_1_rule_extractor:{document_type.value}",
        )
        )
    return extracted_fields


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
