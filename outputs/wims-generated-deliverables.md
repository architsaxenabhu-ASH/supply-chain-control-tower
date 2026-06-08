# Warehouse Inventory and Shipment Management Application

Generated project assets:

## Database Schema

- `database/schema.sql`

Includes:

- Product Master
- Inventory Batch Management
- Shipment Requests
- Shipment Lines
- Dispatches
- Goods Receipts
- Physical Inventory Counts
- Expiry Buckets
- Customer Master
- Roles, Permissions, Users
- Audit Logs
- Dashboard Views

## UI Screens

Frontend screen:

- `frontend/src/pages/App.tsx`

Screens included:

- Dashboard
- Product Master
- Inventory and Batch Management
- Shipment Requests
- Dispatches
- Goods Receipts
- Physical Inventory Counts
- Expiry Management
- Customer Master
- User Roles and Security
- AI Assistant

## Module Relationships

- `docs/module-relationships.md`

## Workflow Diagrams

- `docs/workflows.md`

## API Structure

- `docs/api-structure.md`
- `docs/stock-workflow-rules.md`
- `docs/document-testing-guide.md`
- `docs/global-import-portal.md`
- `docs/import-validation-rules.md`
- `docs/self-learning-engine.md`
- `docs/portal-roadmap.md`
- `outputs/exp-0361-extraction-analysis.md`
- `outputs/exp-0361-line-items.csv`

Backend route modules:

- Products
- Customers
- Inventory
- Shipments
- Dispatches
- Goods Receipts
- Inventory Counts
- Expiry
- Dashboard
- Assistant

## Reporting Framework

- `docs/reporting-framework.md`

Reports:

- Inventory Stock Report
- Expiry Report
- Shipment Report
- Dispatch Report
- Variance Report
- Batch Traceability Search

## Deployment Scaffold

- `deployment/docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`

## Current Status

The application foundation is generated with sample data, API-ready structures, and frontend API integration.

The first stock workflow engine is now added for goods receipt, shipment approval, dispatch confirmation, product creation, and inventory count variance.

The Documents screen is now added back into the main app so upload triggers scanning and extraction-master generation.

The EXP 0361 real-document set has been analyzed. Invoice and packing list are text-readable; AWB is image-based and needs OCR.

The next build step is to add real document-template parsers for the Meril invoice and packing list layouts, then connect a stronger OCR engine for AWB/scanned PDFs/images.

Import Validation Screen foundation is now added with warehouse lookup, Country Incharge approver rule, first-time product learning status, and edit-reason governance.
