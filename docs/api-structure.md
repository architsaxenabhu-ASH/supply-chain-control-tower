# API Structure

Base path:

`/api/v1`

## Product Master

- `GET /products`
- `POST /products`
- `GET /products/{item_code}`
- `PUT /products/{item_code}`
- `GET /products/search`

## Inventory

- `GET /inventory/batches`
- `GET /inventory/balances`
- `GET /inventory/value`
- `GET /inventory/traceability/{batch_number}`
- `GET /inventory/fefo/{item_code}`

## Goods Receipts

- `GET /goods-receipts`
- `POST /goods-receipts`
- `POST /goods-receipts/{grn_number}/post`

## Shipment Requests

- `GET /shipments`
- `POST /shipments`
- `GET /shipments/{shipment_id}`
- `POST /shipments/{shipment_id}/submit`
- `POST /shipments/{shipment_id}/approve`

## Dispatches

- `GET /dispatches`
- `POST /dispatches`
- `POST /dispatches/{dispatch_number}/confirm`

## Physical Inventory Counts

- `GET /inventory-counts`
- `POST /inventory-counts`
- `POST /inventory-counts/{inventory_count_id}/approve`
- `GET /inventory-counts/variance-summary`

## Expiry Management

- `GET /expiry/buckets`
- `GET /expiry/alerts`

## Customers

- `GET /customers`
- `POST /customers`
- `GET /customers/{customer_code}`

## Dashboard

- `GET /dashboard/summary`
- `GET /dashboard/inventory-by-warehouse`
- `GET /dashboard/inventory-by-category`
- `GET /dashboard/open-shipments`
- `GET /dashboard/expiry-alerts`
- `GET /dashboard/variance-summary`

## AI Assistant

- `POST /assistant/query`

Supported example questions:

- Show all batches expiring within 180 days.
- Which shipments are pending dispatch?
- What is the current stock of Item Code AOAC-10/35?
- Show inventory value by warehouse.
- Which customer received a specific batch?
- Show stock variance report.

