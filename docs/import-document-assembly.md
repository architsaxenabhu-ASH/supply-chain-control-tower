# Import Document Assembly

## Purpose

The import portal now connects three uploaded documents into one import validation file.

The user selects:

- Commercial Invoice
- Packing List
- Air Waybill

The system then creates an import validation candidate.

## What The System Extracts Today

From Commercial Invoice:

- invoice number
- invoice date
- destination entity
- destination country
- origin country
- currency
- package count
- gross weight
- product codes
- product descriptions
- quantity
- UOM
- unit value

From Packing List:

- invoice number
- invoice date
- destination country
- origin country
- product codes
- batch numbers
- expiry dates
- calculated days to expiry
- quantity
- net/gross weight

From AWB:

- AWB fields are attempted from readable text.
- If the AWB is scanned/image-only and OCR is not installed, the system flags it for manual validation.
- If OCR is installed, the system renders image-only PDF pages and extracts AWB text using Tesseract.

## Important Rule

Document assembly creates a validation candidate only.

It does not increase stock.

Stock increases only after approved Goods Receipt into the destination warehouse.

The user does not enter remaining shelf life manually. The system calculates days to expiry from the expiry date and today's date.

## Current Test Result

Using the EXP 0361 sample documents, the system assembled:

- Import file: `IMP-IT-2926200361`
- Destination country: `Italy`
- Invoice number: `2926200361`
- Invoice date: `2026-05-29`
- Product lines: `7`
- AWB number: `020-04683840`
- Carrier: `Lufthansa Cargo AG Ltd`
- Flight number: `LH8023`
- Flight date: `2026-05-31`
- Chargeable weight: `2.5 kg`

## Next Build Step

Validation and receipt procedure:

1. save destination warehouse candidate
2. save first-time product answers for all unknown lines
3. validate AWB fields manually when OCR is not available
4. approve import validation as Country Incharge
5. post Goods Receipt into the selected destination warehouse
6. show the received batches in Inventory and Goods Receipts

## Where The Data Appears

Before posting stock:

- Import Validation screen shows the assembled import file
- Import Product Lines table shows item, batch, expiry, days to expiry, quantity, and value
- Import summary shows invoice, AWB, carrier, flight, and destination country

After posting Goods Receipt:

- Inventory screen shows the received batches at the selected warehouse
- Receipts screen shows the generated GRN
- Dashboard inventory totals update

## Stock Posting Rule

The button `Validate and post Goods Receipt` is the stock-changing step.

The system creates:

```text
GRN-{Import File Number}
```

For example:

```text
GRN-IMP-IT-2926200361
```

Imported products that are not yet in Product Master are shown as pending product master records until the user completes product learning.
