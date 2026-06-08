# Document Testing Guide

## Goal

When a document is uploaded, the system should immediately:

1. Save the original file locally.
2. Detect the selected document type.
3. Scan/read the document.
4. Extract the expected fields.
5. Generate required-field readiness checks.
6. Generate pending master candidates.
7. Stop before transaction creation until a human validates the extracted values.

## First Documents To Test

Please test with one real document from each type:

- Commercial Invoice
- Packing List
- Air Waybill

Best first test set:

- One clean text-based PDF or Excel/CSV file
- One scanned PDF
- One image file, if your business actually receives images

## What To Check After Upload

For every uploaded document, check:

- Was the file saved?
- Was the extraction master generated?
- Did required-field readiness show missing fields correctly?
- Did Supplier, Customer, Product, Carrier, UOM, Currency, and Country candidates appear where applicable?
- Were wrong OCR values kept in validation instead of becoming transactions?

## Important Correction

Do not allow raw OCR to create inventory or shipment transactions directly.

Correct sequence:

```text
Upload
Scan / OCR
Extract Details
Generate Master Candidates
Validation
Approval
Transaction Creation
```

Reason:

OCR can misread item codes, batch numbers, expiry dates, and quantities. In a medical device supply chain, a wrong batch or expiry date is not a small mistake. It can create compliance, recall, or patient-safety risk.

## Current Extractor Status

The current app has a Phase 1 extractor:

- Works best with CSV, Excel, and text-based PDFs.
- Creates extraction masters immediately after upload.
- Creates master candidates immediately after upload.
- Checks mandatory fields immediately after upload.

Scanned PDFs, JPG, and PNG files need a real OCR engine connected, such as:

- Tesseract
- PaddleOCR

## What You Should Provide For Testing

If possible, provide:

- 1 Commercial Invoice
- 1 Packing List
- 1 Air Waybill

If documents contain confidential data, mask:

- Prices
- Customer tax IDs
- Bank details
- Personal phone numbers

Do not mask:

- Item code
- Product description
- Batch number
- Quantity
- Expiry date
- AWB number

Those are needed to test the system properly.

