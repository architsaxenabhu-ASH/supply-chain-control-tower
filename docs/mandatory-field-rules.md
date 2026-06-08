# Mandatory Field Rules

These are the first assumed mandatory rules for Phase 1.

The purpose is not to approve transactions automatically. The purpose is to tell the user whether a document has enough information to move into validation.

## Commercial Invoice

Required checks:

- Invoice Identity: Invoice Number
- Invoice Date: Invoice Date
- Seller: Supplier Name or Shipper Name
- Buyer: Customer Name or Consignee Name
- Product Identity: Product Code, Product Name, SKU, Part Number, or Model Number
- Quantity: Quantity
- UOM: UOM
- Traceability: Batch Number, Lot Number, or Serial Number
- Expiry: Expiry Date
- Shipment Reference: AWB Number, MAWB Number, HAWB Number, or Shipment Reference

## Packing List

Required checks:

- Packing List Identity: Packing List Number
- Linked Invoice: Invoice Number
- Product Identity: Product Code, Product Name, SKU, Part Number, or Model Number
- Quantity: Quantity
- UOM: UOM
- Traceability: Batch Number, Lot Number, or Serial Number
- Package Identity: Package Number, Box Number, Pallet Number, or Carton Number
- Weight: Gross Weight or Net Weight
- Shipment Reference: AWB Number, Shipment Reference, or Container Number

## Air Waybill

Required checks:

- AWB Identity: AWB Number, MAWB Number, or HAWB Number
- Shipment Date: Shipment Date or Issue Date
- Shipper: Shipper Name or Supplier Name
- Consignee: Consignee Name or Customer Name
- Carrier: Carrier Name or Carrier
- Origin: Origin Airport
- Destination: Destination Airport
- Package Count: Number Of Packages
- Weight: Gross Weight or Chargeable Weight

## Business Rule

If any required check is missing, the document can still be saved, but it should not be used to create a transaction until the missing value is entered or corrected during validation.

