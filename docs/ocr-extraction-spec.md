# OCR Extraction Specification

This is the master OCR field catalogue for the first version of the Supply Chain Control Tower.

The app starts with three transaction-driving documents:

1. Commercial Invoice
2. Packing List
3. Air Waybill

Future document families:

1. Bill of Lading
2. Bill of Entry / Customs

## Design Principle

OCR should extract more than the minimum transaction fields. Some extracted values will be used immediately for inventory, shipment, and ERP uploads. Other values will support dashboards, audit trails, future AI assistance, and regulatory traceability.

Extracted fields should be stored generically so new document types can be added without changing the core database every time.

## Generic OCR Extracted Data Structure

Each extracted field should be stored as one row:

- `document_id`
- `field_name`
- `extracted_value`
- `confidence_score`
- `corrected_value`
- `validation_status`
- `page_number`
- `bounding_box`
- `source_engine`
- `raw_payload`

Example:

| Document | Field Name | Value |
| --- | --- | --- |
| DOC001 | Invoice Number | INV-2026-001 |
| DOC001 | Customer Name | Apollo Hospital |
| DOC001 | Product Name | Myval THV |
| DOC001 | Batch Number | B240501 |
| DOC001 | Quantity | 25 |

## Commercial Invoice

Expected extraction volume: 50-70 fields.

### Document Level Fields

- Invoice Number
- Invoice Date
- Invoice Type
- Currency
- Incoterm
- Payment Terms
- PO Number
- SO Number
- Reference Number
- Country of Origin
- Country of Export
- Country of Import
- Shipment Mode

### Seller Information

- Supplier Name
- Supplier Code
- Supplier Address
- Supplier Country
- Supplier Tax ID
- Supplier GST/VAT Number

### Buyer Information

- Customer Name
- Customer Code
- Customer Address
- Customer Country
- Customer Tax ID
- Customer GST/VAT Number

### Shipment Information

- AWB Number
- MAWB Number
- HAWB Number
- BOL Number
- Shipment Date
- Carrier Name
- Forwarder Name

### Product Line Information

- Line Number
- Product Code
- Product Name
- SKU
- Part Number
- Model Number
- Batch Number
- Lot Number
- Serial Number
- Quantity
- UOM
- Unit Price
- Line Value

### Medical Device Specific

- Manufacturing Date
- Expiry Date
- Shelf Life
- UDI Number
- GTIN
- Device Classification

### Financial Information

- Unit Price
- Discount
- Tax Amount
- Freight Charges
- Insurance Charges
- Invoice Value
- Net Value
- Gross Value

## Packing List

Expected extraction volume: 40-60 fields.

### Document Level

- Packing List Number
- Packing List Date
- Invoice Number
- PO Number
- Shipment Reference

### Shipment

- AWB Number
- Container Number
- Seal Number
- Carrier
- Forwarder

### Package Details

- Package Number
- Box Number
- Pallet Number
- Carton Number

### Product Details

- Product Code
- Product Name
- Batch Number
- Lot Number
- Serial Number
- Quantity
- UOM

### Weight and Dimensions

- Gross Weight
- Net Weight
- Volume
- Length
- Width
- Height
- CBM

### Medical Device Fields

- Manufacturing Date
- Expiry Date
- Sterile Status
- Temperature Requirement

## Air Waybill

Expected extraction volume: 30-40 fields.

### AWB Header

- AWB Number
- MAWB Number
- HAWB Number
- Issue Date
- Shipment Date

### Parties

- Shipper Name
- Shipper Address
- Consignee Name
- Consignee Address
- Notify Party

### Transportation

- Carrier Name
- Flight Number
- Origin Airport
- Destination Airport
- Transit Airport

### Shipment

- Number Of Packages
- Gross Weight
- Chargeable Weight
- Commodity Description
- Shipment Value

### Tracking

- Tracking Number
- Current Status
- Expected Delivery Date

## Bill of Lading Future Fields

- BOL Number
- Container Number
- Seal Number
- Vessel Name
- Voyage Number
- Port Of Loading
- Port Of Discharge

## Bill of Entry / Customs Future Fields

- BOE Number
- BOE Date
- HS Code
- Duty Amount
- Customs Value
- Importer Name
- Exporter Name

