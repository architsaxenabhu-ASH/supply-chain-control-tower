# Module Relationships

```mermaid
erDiagram
    PRODUCT_CATEGORIES ||--o{ PRODUCTS : classifies
    UOMS ||--o{ PRODUCTS : measures
    PRODUCTS ||--o{ INVENTORY_BATCHES : stocked_as
    WAREHOUSES ||--o{ INVENTORY_BATCHES : stores
    SUPPLIERS ||--o{ GOODS_RECEIPTS : supplies
    GOODS_RECEIPTS ||--o{ GOODS_RECEIPT_LINES : contains
    PRODUCTS ||--o{ GOODS_RECEIPT_LINES : received
    CUSTOMERS ||--o{ SHIPMENT_REQUESTS : receives
    SHIPMENT_REQUESTS ||--o{ SHIPMENT_LINES : contains
    PRODUCTS ||--o{ SHIPMENT_LINES : requested
    INVENTORY_BATCHES ||--o{ SHIPMENT_LINES : allocated
    SHIPMENT_REQUESTS ||--o{ DISPATCHES : dispatched_as
    TRANSPORTERS ||--o{ DISPATCHES : carries
    WAREHOUSES ||--o{ PHYSICAL_INVENTORY_COUNTS : counted_at
    PHYSICAL_INVENTORY_COUNTS ||--o{ PHYSICAL_INVENTORY_COUNT_LINES : contains
    PRODUCTS ||--o{ PHYSICAL_INVENTORY_COUNT_LINES : counted
    USERS ||--o{ AUDIT_LOGS : performs
```

## Key Relationship Rules

- Product cannot be deleted if inventory batches exist.
- Shipment line must reference a valid inventory batch.
- Dispatch must reference an approved shipment.
- Dispatch reduces inventory.
- Goods receipt increases inventory.
- Physical count reconciliation creates adjustment movements.
- Audit logs should capture create, update, approve, dispatch, receipt, and reconciliation events.

