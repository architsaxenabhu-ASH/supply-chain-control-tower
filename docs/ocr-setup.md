# OCR Setup

## Selected OCR Engine

Phase 1 uses Tesseract OCR.

Reason:

- The backend already uses `pytesseract`.
- It works locally on Windows.
- It is enough to start reading scanned AWB/image documents.
- It is lighter than PaddleOCR for the first prototype.

## Installed Engine

Installed with Windows Package Manager:

```powershell
winget install --id tesseract-ocr.tesseract --exact --accept-package-agreements --accept-source-agreements --silent
```

Installed path used by the backend:

```text
C:\Program Files\Tesseract-OCR\tesseract.exe
```

## Backend Behavior

The backend first tries to extract readable PDF text.

If a PDF has no readable text, the backend renders the PDF page as an image and runs Tesseract OCR.

This is needed for scanned/image-based documents such as the AWB sample.

## Current Test Result

The AWB sample now extracts:

- AWB Number: `020-04683840`
- Carrier: `Lufthansa Cargo AG Ltd`
- Flight Number: `LH8023`
- Flight Date: `2026-05-31`
- Chargeable Weight: `2.5 kg`

## Future OCR Upgrade

Add PaddleOCR later when we need stronger table detection, layout detection, multi-column reading, and more accurate scanned document extraction.
