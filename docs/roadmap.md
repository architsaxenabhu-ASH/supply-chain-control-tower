# Implementation Roadmap

## Phase 1: Foundation

- Define PostgreSQL schema for masters and document workflow.
- Build FastAPI app shell with health endpoint.
- Build React shell with dashboard layout.
- Implement authentication and role scaffolding.
- Implement audit trail primitives.

## Phase 2: Document Intake

- Upload PDF, Excel, CSV, JPG, and PNG files.
- Store document metadata and processing status.
- Create OCR extraction log records.
- Add manual upload review screen.

## Phase 3: Extraction and Validation

- Integrate OCR service adapter.
- Create extracted field records.
- Route extracted values into validation queue.
- Support approve, reject, correct, and resubmit.

## Phase 4: Inventory and Shipments

- Create inventory movements from approved validations.
- Maintain stock balances by product, warehouse, batch, serial, expiry, and status.
- Create shipment master and shipment lines.
- Add shipment tracking states.

## Phase 5: ERP and Forecasting

- Add template master for output file generation.
- Generate Excel outputs with configurable column mappings.
- Add forecast upload and comparison views.
- Add ERP upload history.

## Phase 6: Control Tower Analytics

- Build dashboard KPIs.
- Add exceptions and aging queues.
- Add inventory risk and expiry views.
- Add shipment performance dashboards.

## Phase 7: AI Copilot

- Add AI-assisted field extraction.
- Add document Q&A.
- Add validation suggestions.
- Add anomaly detection and forecasting assistance.

