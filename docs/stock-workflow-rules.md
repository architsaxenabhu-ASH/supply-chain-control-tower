# Stock Workflow Rules

This document defines the first business engine for inventory movement.

## 1. Product Creation

Rule:

- Item Code must be unique.

If the same Item Code already exists, the system rejects the new product.

API:

- `POST /api/v1/products`

## 2. Goods Receipt

Purpose:

- Goods Receipt increases warehouse inventory.

Rules:

- GRN Number must be unique.
- Goods receipt must contain at least one line.
- Product must already exist.
- Quantity received must be greater than zero.
- If the same item, batch, and warehouse already exists, stock quantity increases.
- If the batch does not exist, the system creates a new inventory batch.

API:

- `POST /api/v1/goods-receipts/post`

Result:

- Inventory increases.
- Goods receipt history is saved.

## 3. Shipment Approval

Purpose:

- Shipment approval confirms how much stock is allowed to be dispatched.

Rules:

- Shipment must exist.
- Shipment must be in Draft or Submitted status.
- Every shipment line must have an approval line.
- Approved quantity cannot exceed requested quantity.
- Approved quantity cannot exceed available inventory.

API:

- `POST /api/v1/shipments/{shipment_id}/approve`

Result:

- Shipment status becomes Approved.
- Approved quantities are recorded.
- Inventory is not reduced yet.

## 4. Dispatch Confirmation

Purpose:

- Dispatch confirmation physically moves stock out of the warehouse.

Rules:

- Shipment must exist.
- Shipment must be Approved before dispatch.
- Dispatch Number must be unique.
- Dispatch quantity must be greater than zero.
- Dispatch quantity cannot exceed available stock.

API:

- `POST /api/v1/dispatches/{shipment_id}/confirm`

Result:

- Inventory is reduced.
- Dispatch record is saved.
- Shipment status becomes Dispatched.

## 5. Physical Inventory Count

Purpose:

- Physical count compares system stock with actual counted stock.

Rules:

- Inventory Count ID must be unique.
- Count must contain at least one line.
- Variance is calculated automatically.

Formula:

```text
Variance Quantity = Physical Quantity - System Quantity
```

Variance Type:

- Positive variance = Excess
- Negative variance = Deficit
- Zero variance = Matched

API:

- `POST /api/v1/inventory-counts`

## Important Control Rule

Stock is changed only by:

- Goods Receipt
- Dispatch
- Future approved reconciliation adjustment

Shipment approval does not reduce stock. It only confirms that stock is available and approved for dispatch.

