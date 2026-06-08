# Initial Data Model

This model preserves the Zoho Creator prototype domains while preparing for PostgreSQL implementation.

## Common Columns

Most business tables should include:

- `id`
- `code`
- `name`
- `is_active`
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`

Transaction and workflow tables should also include:

- `status`
- `remarks`
- `source_document_id`
- `approved_at`
- `approved_by`

## Master Data

- `business_units`
- `countries`
- `currencies`
- `entities`
- `warehouses`
- `product_categories`
- `uoms`
- `products`
- `customers`
- `suppliers`
- `carriers`
- `verticals`
- `movement_types`
- `inventory_statuses`
- `shipment_statuses`
- `document_types`
- `document_statuses`
- `roles`
- `users`

## Document Workflow

- `documents`
  - Uploaded file metadata, document type, status, source system, storage path.
- `ocr_extraction_logs`
  - Processing attempt, OCR engine, start/end time, success/failure, confidence summary.
- `ocr_extracted_data`
  - Generic extracted field storage: field name, extracted value, confidence score, corrected value, validation status, page number, bounding box, source engine, raw payload.
- `data_validation_queue`
  - Review task for extracted values, assigned user, decision, corrected value, approval status.
- `template_masters`
  - ERP/upload template configuration and output mapping.

## Document Type Families

Initial document types:

- Commercial Invoice
- Packing List
- Air Waybill

Future document types:

- Bill of Lading
- Bill of Entry / Customs

## OCR Field Catalogue

The detailed extraction field catalogue is maintained in `docs/ocr-extraction-spec.md`.

The transaction mapping blueprint is maintained in `docs/transaction-mapping.md`.

## Inventory

- `inventory_balances`
  - Product, warehouse, quantity, UOM, batch, serial, expiry date, inventory status.
- `inventory_movements`
  - Movement type, source/destination warehouse, quantity, source document, validation reference.

## Shipments

- `shipments`
  - Shipment header, carrier, origin, destination, status, tracking reference, estimated and actual dates.
- `shipment_lines`
  - Shipment item details, product, quantity, batch, serial, expiry, order references.

## Orders and Forecasting

- `sales_orders`
- `sales_order_lines`
- `purchase_orders`
- `purchase_order_lines`
- `forecast_uploads`
- `forecast_lines`

## Audit and Access Control

- `audit_events`
  - Actor, action, entity type, entity id, old value, new value, timestamp.
- `role_permissions`
  - Role-to-permission mapping.
- `user_roles`
  - User-to-role mapping.

## First Schema Priority

Build in this order:

1. Users, roles, and audit events
2. Core masters required by documents and products
3. Documents, OCR logs, extracted data, validation queue
4. Inventory movements and balances
5. Shipments and shipment lines
6. Orders, forecasts, and ERP output history
