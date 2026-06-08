# Saved Work Summary

Project saved as of the current checkpoint.

## Project

Supply Chain Control Tower / Warehouse Inventory and Shipment Management Application

## What Has Been Built

- Project documentation and start guides
- OCR extraction specification for Commercial Invoice, Packing List, and Air Waybill
- Phase 1 document upload portal design
- Warehouse Inventory and Shipment Management blueprint
- Complete PostgreSQL schema
- Module relationship diagram
- Workflow diagrams
- API structure
- Reporting framework
- Backend FastAPI scaffold and route modules
- Frontend React dashboard and module screens
- Frontend API integration with sample-data fallback
- First stock workflow engine
- Documents screen for upload-triggered scan/extraction
- Real document extraction analysis for EXP 0361 invoice, packing list, and AWB
- Global import portal direction for foreign Meril subsidiaries
- Self-learning engine design and first backend learning structures
- Import Validation Screen foundation
- Import document assembly from uploaded Commercial Invoice, Packing List, and AWB records
- Import validation can now post a Goods Receipt into a selected/entered destination warehouse
- Destination warehouse lookup with "ask if unknown" behavior
- No-hardcoded-master-data rule for future countries, products, warehouses, verticals, and document requirements
- In-app learning actions for first-time product answers, warehouse candidates, and country document requirements
- Generic `New Record` top-bar action removed because inventory must change only through controlled workflows
- Export button now downloads CSV for the active screen
- Inventory screen now has warehouse filter and free-text search for material code, batch, description, and category
- Country Incharge import validation approver rule
- Product profile edit reason/audit event logic
- Tesseract OCR installed and wired for scanned/image-based PDF fallback
- Remaining shelf life removed from manual entry; import lines now calculate days to expiry
- Local SQLite persistence added at `data/control_tower.db`
- Warehouse, inventory batch, goods receipt, shipment, dispatch, customer, count, and learning state now persist across backend restarts
- Basic audit event table added for future immutable transaction history
- Executive dashboard KPIs expanded with total quantity, 30/60/90-day expiry risk, expired inventory, receipts today, and persisted backend status
- Mobile dashboard navigation improved so the dashboard appears in the first viewport on narrow screens
- Current-state roadmap and dashboard architecture documents added
- Inventory screen now includes a Vertical filter alongside warehouse and free-text search
- Import Validation now has an approval gate: Country Incharge approval is required before Goods Receipt posting
- Backend blocks import Goods Receipt posting unless the import candidate status is `validated`
- Git installed on Windows using `winget install Git.Git`
- Project initialized as a local Git repository on branch `main`
- Safe project files committed to Git while runtime data, uploads, SQLite database files, logs, generated zip files, virtual environments, and node modules are ignored
- Git/data boundary documented in `docs/git-and-data-backup.md`
- Added non-IT PostgreSQL setup guide in `docs/postgresql-setup-for-non-it.md`
- Added local secret-safe database URL setup script: `scripts/set-database-url.ps1`
- Verified database setup script using a temporary `.env` path without changing the real backend settings
- Frontend dependency lock file after npm installation
- Deployment scaffold using Docker
- Sample CSV files for document upload testing

## Main User-Facing Files

- `outputs/OPEN-ME-FIRST.txt`
- `outputs/wims-generated-deliverables.md`
- `outputs/vscode-start-guide.md`
- `outputs/phase-1-start-guide.md`

## Main Technical Files

- `database/schema.sql`
- `frontend/src/pages/App.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/styles.css`
- `backend/app/main.py`
- `backend/app/api/router.py`
- `backend/app/services/warehouse_repository.py`
- `backend/app/services/learning_repository.py`
- `backend/app/db/local_persistence.py`
- `docs/stock-workflow-rules.md`
- `docs/current-state-assessment-and-roadmap.md`
- `docs/dashboard-architecture.md`
- `docs/document-testing-guide.md`
- `outputs/exp-0361-extraction-analysis.md`
- `outputs/exp-0361-line-items.csv`
- `outputs/global-import-and-learning-next-step.md`
- `docs/global-import-portal.md`
- `docs/import-document-assembly.md`
- `docs/import-validation-rules.md`
- `docs/self-learning-engine.md`
- `docs/ocr-setup.md`
- `docs/no-hardcoded-master-data.md`
- `docs/portal-roadmap.md`
- `deployment/docker-compose.yml`

## Verification Completed

- Backend Python syntax check passed.
- Dashboard service test passed.
- AI assistant sample query test passed.
- Frontend is wired to backend API functions, with fallback sample data.
- Shipment approval checks available stock.
- Dispatch confirmation reduces inventory.
- Goods receipt posting increases inventory.
- Physical inventory count calculates variance.
- Document upload triggers scan/extraction master generation through the backend.
- Invoice and packing list PDFs were confirmed as text-readable through `pypdf`.
- AWB PDF was confirmed as image-based and needs real OCR.
- Product learning profile can now say whether an item is known or needs first-time questions.
- Import preview is exposed as a latest scanned import preview route; EXP 0361 remains only a temporary development fixture.
- Italy currently has no configured warehouse, so the Import Validation screen asks for a warehouse name.
- Product profile edit endpoint rejects edits without a mandatory reason.
- Learning rules and product profiles start empty and grow from user/app input.
- Backend virtual environment dependencies were installed for actual FastAPI import checks.
- Latest import preview endpoint smoke test passed with all products marked as first-time questions.
- Real uploaded EXP 0361 documents assembled into `IMP-IT-2926200361` with 7 product lines.
- Browser test passed for document selection, import assembly, AWB OCR warning, warehouse prompt, first-time product questions, and product line rendering.
- Tesseract OCR extracted AWB `020-04683840`, carrier `Lufthansa Cargo AG Ltd`, flight `LH8023`, flight date `2026-05-31`, and chargeable weight `2.5 kg`.
- Browser test passed with no shelf-life input/column and with calculated `Days to Expiry`.
- Import Goods Receipt posting API test passed and showed 7 imported batches in the selected warehouse.
- UI now shows supplier, destination warehouse, and `Validate and post Goods Receipt` controls.
- Browser test passed for Inventory filters, removed New Record button, and CSV export status.
- Node.js and npm were installed and verified through `npm.cmd`.
- Frontend dependencies installed with zero vulnerabilities reported.
- Frontend production build passed.
- Local backend started at `http://127.0.0.1:8000`.
- Local frontend started at `http://127.0.0.1:5173`.
- Browser check passed: dashboard and Import Validation screen loaded with no console errors.
- Import Validation browser test passed: Italy file loads, warehouse prompt appears, first-time product questions appear, and product lines render.
- PowerShell start guides now use one-time ExecutionPolicy Bypass commands.
- Backend compile check passed after SQLite persistence changes.
- SQLite restart-survival test passed with a temporary database: a GRN posted in one Python process was visible in a fresh Python process.
- Dashboard summary API now returns persisted executive metrics.
- Frontend production build passed after dashboard KPI and responsive navigation changes.
- Browser QA passed on narrow viewport: dashboard loads, ten KPI cards render, backend status connects, and Export reports a successful dashboard CSV export.
- Browser QA passed on desktop viewport: dashboard layout renders with ten KPI cards, no framework overlay, and no console warnings.
- Fresh backend process restarted at `http://127.0.0.1:8000` using the SQLite-backed code.
- Git commit created for the first prototype checkpoint: `75fa4d9 Initial supply chain control tower prototype`.
- Browser QA passed for Inventory vertical filter: selecting `Cardio` reduced visible batches to 2.
- Browser QA passed for Import Validation approval gate: pending import blocked Goods Receipt, approval changed status to `validated`, then Goods Receipt button became enabled.

## Pending

- Push code to a private GitHub repository after the user provides a GitHub repository URL or connects a GitHub destination.
- Build email login and role-based access control.
- Make audit logs fully immutable and expose audit views in the UI.
- Migrate from SQLite to PostgreSQL for production deployment.
- Replace remaining frontend fallback sample arrays once every module has durable records.
- Add UI forms for create, approve, dispatch, receive, and inventory count actions.
- Expand parsers for more invoice and packing list layouts.
- Add manual correction form for OCR-extracted AWB fields.
- Add PaddleOCR later for stronger table and layout extraction.
- Persist full import validation queues and document grouping records as first-class database records.
- Add UI edit action with mandatory reason for autofilled product values.
- Replace the temporary import fixture with real import candidates generated from uploaded document groups.
