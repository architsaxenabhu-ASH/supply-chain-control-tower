# Claude Code Handover

## Project

Supply Chain Control Tower: a document-driven warehouse, import, inventory, shipment, ERP upload, dashboard, and RBAC platform for a healthcare/medical device company.

The user is non-technical and owns the business logic. Keep explanations simple and practical. Do not hardcode new countries, warehouses, products, verticals, approvers, or country-specific document requirements. New business data must be captured in the application and learned over time.

## Current Stack

- Backend: FastAPI in `backend/`
- Frontend: React + TypeScript + Vite in `frontend/`
- Prototype persistence: local SQLite / JSON under `data/`
- Production target: managed PostgreSQL plus durable document storage
- OCR/document tools already planned: PyMuPDF, pdfplumber, Tesseract, PaddleOCR

## How To Run Locally

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
```

Frontend normally runs on `http://localhost:5173`.
Backend normally runs on `http://localhost:8000`.

Do not commit `.env`, local databases, uploaded documents, tunnels, or passwords.

## Current Implemented Areas

- Document upload and scan trigger
- Extraction master and required-field readiness
- Validation queue with correction reason and audit trail
- Import validation workflow
- Goods receipt posting after approval
- Inventory, shipments, dispatches, receipts, counts, expiry, dashboards
- Email-based RBAC foundation
- Product learning profiles
- Country/vertical/material document requirement learning
- ERP upload preview center
- Modern command-center UI, guided tour, role-aware navigation

## Latest Business Correction

One AWB can cover many commercial invoices and many packing lists. The application now treats the import shipment as the parent and selected documents as children.

Shipment name format should be:

```text
COUNTRY-VERTICAL-SHIPMENTNO
```

Example:

```text
ITALY-CARDIO-0361
```

Commercial invoices and packing lists are multi-select in Import Validation. AWB remains a single optional transport reference for now.

## Next Jobs

1. Finish true shipment document-bundle persistence.
   Store parent shipment, child document links, and document role metadata as first-class records, not only inside the import candidate.

2. Improve line matching.
   Current extraction mostly matches by item code. Medical device traceability needs item code + batch/lot/serial where available, so multiple batches of the same item are not merged incorrectly.

3. Add production OCR pipeline.
   Use the current scan trigger, but replace prototype extraction with stronger OCR/table extraction and confidence scoring.

4. Move runtime data to PostgreSQL.
   Keep local development easy, but production data should live in the managed database. Never put database credentials into Git.

5. Add country-specific import checklist workflow.
   Country + vertical + material code should decide extra documents. Unknown combinations should ask the user and save the learned rule.

6. Strengthen RBAC.
   Country Incharge approves imports for their country. Admin can change roles and users from the app.

7. Build permanent deployment.
   Temporary local/network tunnels are not production. Create a deployable frontend/backend/database setup.

## User Direction

The user asked that Claude Code continue future work in this same VS Code workspace if Codex weekly limit is reached. Continue from the current Git branch, read the code first, run checks before finalizing, and explain each step in plain business language.

