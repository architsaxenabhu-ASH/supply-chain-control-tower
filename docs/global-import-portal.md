# Global Import Portal

## Business Context

Meril India is the sole manufacturer and exporter.

Foreign Meril entities are destination/importing subsidiaries. They buy from India and then either:

- Sell to local customers.
- Sell to another Meril entity.
- Hold stock in the local warehouse.

The platform starts when the destination subsidiary receives the core import document set.

## First Common Document Set

The common global import document set is:

- Commercial Invoice
- Packing List
- Air Waybill

Country-specific documents can be added later:

- Bill of Entry
- Certificate of Origin
- Customs Declaration
- Import Permit
- Local tax documents
- Country-specific regulatory certificates

## Correct Operating Flow

```text
Upload common documents
-> Scan / extract
-> Group documents into one import file
-> Cross-check invoice, packing list, and AWB
-> Generate import shipment candidate
-> Generate product, batch, customer, carrier, and country master candidates
-> Validate and approve
-> Track import process in destination country
-> Post goods receipt into destination warehouse
```

## Inventory Direction

For this portal, the viewpoint is the destination/importing subsidiary.

Therefore:

- Invoice + Packing List + AWB create an import shipment candidate.
- Stock does not increase immediately after document upload.
- Stock increases only when the destination warehouse confirms goods receipt.

## Import Statuses

Suggested statuses:

- Documents Pending
- Uploaded
- Extracted
- Validation Pending
- Validated
- Country Documents Pending
- Customs In Progress
- In Transit
- Arrived
- Goods Receipt Pending
- Received
- Closed

## Import Portal Screens

### 1. Import Upload Console

Purpose:

- Upload Invoice, Packing List, and AWB together or separately.
- Auto-group documents using invoice number, PO number, SO number, AWB number, and customer references.

### 2. Import Document Review

Purpose:

- Show extracted fields.
- Show confidence.
- Show missing fields.
- Show conflicts between documents.

### 3. Product and Batch Review

Purpose:

- Show product lines from invoice and packing list.
- Confirm item code, batch, expiry, quantity, UOM, and value.
- Ask first-time product questions.
- Autofill known product details for repeat products.

### 4. Import Shipment Tracker

Purpose:

- Track carrier, AWB, route, flight, chargeable weight, arrival status, customs status, and delivery status.

### 5. Goods Receipt

Purpose:

- Post stock into the importing subsidiary warehouse after actual receipt.

## Cross-Document Validation

The system should compare:

- Invoice number
- Invoice date
- SO number
- Customer PO number
- Buyer / consignee
- Item codes
- Quantities
- Batch numbers
- Expiry dates
- Net weight
- Gross weight
- Package count
- AWB number
- Origin and destination

If documents disagree, the import file must remain in validation.

## Harsh Rule

Do not let document upload directly increase inventory.

Reason:

The documents prove the shipment exists, but they do not prove the goods were physically received in the foreign warehouse.

Correct stock event:

```text
Goods Receipt in destination warehouse = stock increase
```

