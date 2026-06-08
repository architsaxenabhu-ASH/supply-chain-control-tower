# Supply Chain Control Tower

Enterprise-grade supply chain management platform for a medical device company.

The system is designed around a document-driven operating model:

1. Users upload documents.
2. OCR/extraction services identify business fields.
3. Users validate extracted values.
4. Approved data creates transactions.
5. The platform updates inventory, shipments, orders, forecasts, dashboards, and ERP upload outputs.

## Target Stack

- Backend: FastAPI, SQLite for the local prototype, PostgreSQL for production
- Frontend: React, TypeScript, Tailwind
- OCR: PaddleOCR, Tesseract
- Document processing: PyMuPDF, pdfplumber
- AI extraction support: Ollama, Llama 3, DeepSeek
- Excel processing: openpyxl, pandas

## Repository Structure

- `backend/`: FastAPI application scaffold
- `frontend/`: React application scaffold
- `docs/`: architecture, data model, and roadmap notes
- `database/`: PostgreSQL schema
- `deployment/`: Docker deployment scaffold
- `outputs/`: user-facing deliverables
- `work/`: scratch/intermediate files

## First Build Milestone

The first implementation milestone should focus on the document-to-validation path:

1. Master data APIs
2. Document upload API
3. OCR extraction log and extracted data records
4. Validation queue
5. Manual approval flow
6. Transaction creation stub for inventory movement

## Key Documents

- `docs/architecture/overview.md`: system architecture and workflow
- `docs/data-model.md`: initial PostgreSQL data model map
- `docs/ocr-extraction-spec.md`: OCR field catalogue for Invoice, Packing List, AWB, and future documents
- `docs/transaction-mapping.md`: mapping from extracted fields to goods movement transactions
- `docs/phase-1-document-upload-portal.md`: first upload portal phase in plain business language
- `docs/mandatory-field-rules.md`: first mandatory-field assumptions for validation readiness
- `docs/stock-workflow-rules.md`: inventory-changing business rules
- `docs/global-import-portal.md`: import process for foreign Meril subsidiaries
- `docs/import-document-assembly.md`: uploaded invoice, packing list, and AWB assembly into one import validation file
- `docs/import-validation-rules.md`: warehouse, approver, country-document, and product-learning validation rules
- `docs/self-learning-engine.md`: correction-driven learning design
- `docs/no-hardcoded-master-data.md`: rule that new business information must be captured and learned inside the app
- `docs/git-and-data-backup.md`: rule that code goes to GitHub and operational data goes to database/document storage
- `docs/cloud-database-next-step.md`: next step for moving runtime data from SQLite to PostgreSQL
- `docs/ocr-setup.md`: Tesseract OCR installation and current AWB extraction result
- `docs/portal-roadmap.md`: import, sales, inventory, and unified control tower phases
- `docs/roadmap.md`: phased delivery roadmap
- `database/schema.sql`: PostgreSQL database schema
- `deployment/docker-compose.yml`: deployment scaffold

## Phase 1 Local Storage

The document upload portal stores local files and extraction masters under:

- `data/uploads`
- `data/extraction_masters`
- `data/master_candidates`
- `data/documents.json`

The local prototype database is:

- `data/control_tower.db`

This SQLite database now persists warehouse, inventory batch, goods receipt, shipment, dispatch, customer, count, and learning state across backend restarts.

## Environment Notes

Python and frontend dependencies have been installed locally in this workspace. PostgreSQL is still a future production deployment step; it is not required for the current local prototype.
