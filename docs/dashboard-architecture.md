# Supply Chain Control Tower - Dashboard Architecture

## Executive Dashboard

Purpose: single-screen business overview.

KPIs:

- Total Inventory Value
- Total Inventory Quantity
- Inventory Aging
- Inventory Expiring in 30, 60, and 90 Days
- Open Shipments
- Delayed Shipments
- Open Purchase Orders
- Open Sales Orders
- Forecast Accuracy
- Inventory Coverage in Days
- Revenue at Risk
- Compliance Alerts

Visuals:

- Inventory Trend
- Shipment Trend
- Forecast Accuracy Trend
- Country Performance Map

## Document Control Tower

Purpose: track every uploaded document.

KPIs:

- Documents Uploaded Today
- OCR Success Rate
- Validation Pending
- Validation Rejected
- Average Processing Time

Views:

- Invoice Queue
- Packing List Queue
- AWB Queue
- Exception Queue

## OCR And Learning Dashboard

Purpose: monitor extraction quality.

KPIs:

- OCR Accuracy
- Documents Processed
- Auto Approved %
- Manual Corrections %
- Learning Rules Created
- Confidence Score Distribution

Views:

- Supplier Layout Learning
- Product Mapping Learning
- Customer Alias Learning
- Field Mapping Accuracy

## Import Operations Dashboard

Purpose: monitor inbound shipments.

KPIs:

- Inbound Shipments
- Goods in Transit
- Customs Clearance Pending
- Goods Received Today
- GRN Pending

Views:

- Shipment Status
- Country Status
- Carrier Status

## Inventory Control Tower

Purpose: inventory visibility.

KPIs:

- On Hand Inventory
- Available Inventory
- Reserved Inventory
- Blocked Inventory
- Inventory Value

Views:

- Warehouse Inventory
- Product Inventory
- Country Inventory
- Batch Inventory

## Expiry Management Dashboard

Purpose: medical device compliance.

KPIs:

- Expiring in 30 Days
- Expiring in 60 Days
- Expiring in 90 Days
- Expired Inventory

Views:

- Product Risk
- Warehouse Risk
- Country Risk

## Batch Traceability Dashboard

Purpose: regulatory traceability.

Search by:

- Product
- Batch
- Lot
- Serial Number

Show:

- Receipt History
- Shipment History
- Customer History
- Warehouse History

## Shipment Control Tower

Purpose: outbound visibility.

KPIs:

- Open Shipments
- Delivered Shipments
- Delayed Shipments
- Transit Shipments

Views:

- Shipment Tracking
- Carrier Performance
- Transit Timeline
- Delivery Performance

## Other Dashboards

Warehouse Operations:

- Receipts Today
- Dispatches Today
- Cycle Count Accuracy
- Inventory Adjustments

Purchase Order:

- Open POs
- Delayed POs
- Supplier Performance
- PO Value

Sales Order:

- Open SOs
- Fulfillment Rate
- Backorders
- Customer Service Level

Forecast Control Tower:

- Forecast Accuracy
- Demand Trend
- Country Forecast
- Product Forecast

Finance:

- Inventory Value
- Inventory Carrying Cost
- Goods in Transit Value
- Open PO Value
- Open SO Value

Quality And Compliance:

- Expiry Compliance
- Recall Readiness
- Missing Documents
- Regulatory Exceptions

Customer:

- Customer Demand
- Fill Rate
- Service Level
- Order Trend

Supplier:

- On-Time Delivery
- Supplier Lead Time
- Supplier Quality Score

Master Data Governance:

- Missing Master Data
- Duplicate Products
- Duplicate Customers
- Inactive Records
- Data Quality Score
- Data Completeness Score

## AI Copilot Dashboard

Natural language queries:

- Show delayed shipments.
- Show inventory expiring in 90 days.
- Show inventory risk by warehouse.
- Explain forecast variance.
- Summarize today's imports.
- Show open compliance issues.

## Final Target

The application should operate as a real-time Supply Chain Control Tower where executives, supply chain teams, warehouse teams, logistics teams, finance teams, QA teams, and compliance teams all work from the same platform using role-based dashboards.
