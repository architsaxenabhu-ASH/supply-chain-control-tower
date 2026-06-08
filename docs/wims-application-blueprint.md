# Warehouse Inventory and Shipment Management Application

## Objective

Create a centralized system for a healthcare / medical device company to manage:

- Product master
- Inventory and batch management
- Shipment requests
- Shipment line approvals
- Dispatches
- Goods receipts
- Physical inventory counts
- Expiry tracking
- Role-based access
- Dashboards
- AI assistant queries

## Core Operating Principle

The system should protect inventory integrity.

Goods movement must happen only through controlled transactions:

- Goods Receipt increases stock.
- Dispatch reduces stock.
- Physical Count posts reconciliation adjustments.
- Shipment Approval validates stock availability before dispatch.

## Modules

### Product Master

Mandatory fields:

- Item Code
- Product Description
- Product Category
- UOM
- Product Status

Rules:

- Item Code must be unique.
- Product cannot be deleted when inventory exists.
- Search by item code, description, and category.
- Remaining shelf life is not manually entered in Product Master. It is calculated from batch expiry date and today's date.

### Inventory and Batch Management

Mandatory fields:

- Item Code
- Batch Number
- Warehouse Location
- Quantity Available
- Manufacturing Date
- Expiry Date
- Unit Value

Rules:

- One item code can have multiple batches.
- Inventory value = quantity available x unit value.
- FEFO visibility is based on earliest expiry date.
- Batch traceability links receipts, shipments, dispatches, and customers.

### Shipment Request

Mandatory fields:

- Shipment ID
- Request Date
- Requestor Name
- Customer Name
- Destination Country
- Priority
- Required Delivery Date

Statuses:

- Draft
- Submitted
- Approved
- Dispatched
- Delivered

### Shipment Lines

Mandatory fields:

- Shipment ID
- Item Code
- Batch Number
- Quantity Requested
- Quantity Approved

Rules:

- Quantity approved cannot exceed available inventory.
- Approval should lock the requested batch for dispatch planning.

### Dispatch

Mandatory fields:

- Dispatch Number
- Shipment ID
- Dispatch Date
- Transporter / Courier
- Tracking Number
- Dispatched By

Rules:

- Dispatch reduces inventory.
- Dispatch creates audit and movement history.

### Goods Receipt

Mandatory fields:

- GRN Number
- Receipt Date
- Warehouse
- Supplier
- Item Code
- Batch Number
- Quantity Received
- Expiry Date

Rules:

- Goods receipt increases inventory.
- GRN creates receipt and movement history.

### Physical Inventory Count

Mandatory fields:

- Inventory Count ID
- Count Date
- Warehouse
- Item Code
- Batch Number
- System Quantity
- Physical Quantity

Rules:

- Variance Quantity = Physical Quantity - System Quantity.
- Variances are reported as excess or deficit.
- Approved reconciliation posts inventory adjustment.

### Expiry Management

Mandatory fields:

- Item Code
- Batch Number
- Expiry Date

Buckets:

- 0-90 Days
- 91-180 Days
- 181-365 Days
- Above 365 Days

### Customer Master

Mandatory fields:

- Customer Code
- Customer Name
- Country
- Customer Type
- Contact Person

Rules:

- Customers are linked to shipments and dispatches.

### Roles and Security

Roles:

- Admin
- Warehouse Executive
- Warehouse Manager
- Sales User
- Finance User
- QA User

Requirements:

- Role-based access control
- Approval workflows
- Audit logs for all transactions
