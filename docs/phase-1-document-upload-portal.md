# Phase 1: Document Upload Portal

## Business Purpose

This phase starts the project from the beginning:

1. Upload one source document.
2. Save the original document locally.
3. Identify the document type.
4. Generate an extraction master from the field catalogue.
5. Generate master-data candidates from extracted values.
6. Prepare the extracted fields and candidates for future validation.

## First Document Types

- Commercial Invoice
- Packing List
- Air Waybill

## Local Storage

Uploaded files are saved inside the project:

- `data/uploads`: original uploaded documents
- `data/extraction_masters`: generated extraction master JSON files
- `data/master_candidates`: generated master-data candidate JSON files
- `data/documents.json`: list of saved document records

## Extraction Master

For every upload, the system creates one extraction master.

Example:

| Field Name | Extracted Value | Validation Status |
| --- | --- | --- |
| Invoice Number | INV-2026-001 | pending |
| Supplier Name | ABC Medical Devices | pending |
| Product Code | P-1001 | pending |
| Quantity | 25 | pending |

## Current Extraction Behavior

This phase includes a first-pass rule extractor.

It can extract values when the document contains readable text in a simple label/value format, such as:

```text
Invoice Number: INV-2026-001
Supplier Name: ABC Medical Devices
Quantity: 25
```

Scanned images and image-only PDFs will need the future OCR engine using Tesseract or PaddleOCR.

## What This Phase Does Not Do Yet

- It does not create inventory movement yet.
- It does not create shipment records yet.
- It does not validate or approve values yet.
- It does not auto-approve Supplier, Customer, Product, Carrier, UOM, Currency, or Country masters.
- It does not upload to ERP yet.

Those will come after the upload portal is stable.

## Next Phase

Phase 2 should add the validation screen:

1. Show extracted fields.
2. Allow the user to correct values.
3. Approve or reject fields.
4. Move approved records toward goods movement creation.
