# Transaction Mapping Blueprint

This document explains how extracted document fields become supply chain transactions.

## Core Business Questions

The app must answer:

- Which goods are moving?
- From whom to whom are they moving?
- Where are they moving from and to?
- When are they moving?
- How are they moving?

## Source Documents

The first version uses three source documents:

- Commercial Invoice
- Packing List
- Air Waybill

These documents should be linked together using shared references such as:

- Invoice Number
- PO Number
- SO Number
- AWB Number
- Shipment Reference
- Product Code
- Batch Number
- Serial Number

## Movement Answer Map

| Business Question | Primary Source | Backup Source | Target Transaction |
| --- | --- | --- | --- |
| Which goods? | Invoice line, Packing List product details | Product master | Inventory movement line, Shipment line |
| From whom? | Seller / Shipper | Supplier master | Shipment party, inventory source |
| To whom? | Buyer / Consignee | Customer master | Shipment party, inventory destination |
| From where? | Origin airport, country of export | Supplier country, port/airport master | Shipment origin |
| To where? | Destination airport, country of import | Customer country, warehouse master | Shipment destination |
| When? | Invoice date, shipment date, AWB issue date | Expected delivery date | Shipment dates, movement date |
| How? | Shipment mode, carrier, flight number, AWB | Carrier master | Shipment transport details |

## Validation Before Transaction Creation

No inventory or shipment transaction should be created directly from raw OCR output.

The sequence should be:

1. Upload document.
2. OCR extracts fields.
3. Extracted fields enter validation queue.
4. User corrects or confirms values.
5. Approved values are mapped to transactions.
6. Transactions update inventory, shipments, dashboards, and ERP upload files.

## First Transaction: Inbound Goods Movement

The first automatic transaction should be an inbound goods movement.

Minimum required approved fields:

- Document group reference
- Supplier or shipper
- Customer or consignee
- Product code or product name
- Quantity
- UOM
- Batch number or serial number where applicable
- Expiry date where applicable
- Shipment date or movement date
- AWB number or shipment reference

Optional but valuable fields:

- Manufacturing date
- Country of origin
- Incoterm
- Carrier name
- Forwarder name
- Gross weight
- Net weight
- Package count

## Transaction Creation Rule

If required fields are missing or low confidence, the system should keep the item in validation queue.

If required fields are approved, the system can create:

- Inventory movement
- Shipment master
- Shipment line
- Audit event

## Master Data Matching

The system should attempt to match extracted values to masters:

- Supplier Name -> Supplier Master
- Customer Name -> Customer Master
- Carrier Name -> Carrier Master
- Product Code / Product Name -> Product Master
- UOM -> UOM Master
- Currency -> Currency Master
- Country values -> Country Master

If a match is not found, the validation screen should show the value as an exception and ask the user to map it or create a new master record.

