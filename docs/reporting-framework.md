# Reporting and Dashboard Framework

## Dashboard KPIs

- Total Inventory Value
- Inventory by Warehouse
- Inventory by Product Category
- Expiring Stock Alerts
- Open Shipment Requests
- Dispatched Shipments
- Inventory Variance Summary
- Top Customers
- Batch Traceability Search

## Reports

### Inventory Stock Report

Columns:

- Item Code
- Product Description
- Product Category
- Batch Number
- Warehouse
- Quantity Available
- UOM
- Unit Value
- Inventory Value
- Expiry Date

### Expiry Report

Columns:

- Item Code
- Product Description
- Batch Number
- Warehouse
- Quantity Available
- Expiry Date
- Days to Expiry
- Expiry Bucket

### Shipment Report

Columns:

- Shipment ID
- Request Date
- Customer
- Destination Country
- Priority
- Required Delivery Date
- Status
- Dispatch Number
- Tracking Number

### Dispatch Report

Columns:

- Dispatch Number
- Shipment ID
- Dispatch Date
- Transporter
- Tracking Number
- Dispatched By
- Status

### Variance Report

Columns:

- Inventory Count ID
- Count Date
- Warehouse
- Item Code
- Batch Number
- System Quantity
- Physical Quantity
- Variance Quantity
- Variance Type

## Export Requirements

Every operational report should support:

- Search
- Filter
- Sorting
- Export to Excel
- Export to PDF

## AI Assistant Report Mapping

| User Question | Report / Data Source |
| --- | --- |
| Show all batches expiring within 180 days. | Expiry Report |
| Which shipments are pending dispatch? | Shipment Report |
| What is the current stock of Item Code AOAC-10/35? | Inventory Stock Report |
| Show inventory value by warehouse. | Inventory by Warehouse |
| Which customer received a specific batch? | Batch Traceability Search |
| Show stock variance report. | Variance Report |

