# Backend

FastAPI backend for the Supply Chain Control Tower.

## Planned Modules

- `api`: HTTP routers
- `core`: settings, security, RBAC, audit helpers
- `db`: database session and migrations
- `models`: persistence models
- `schemas`: API contracts
- `services`: business workflows
- `workers`: OCR and document-processing jobs

## Local Run

Once dependencies are installed:

```powershell
uvicorn app.main:app --reload
```

## Phase 1 Endpoints

- `POST /api/v1/documents/upload`: save a local document and generate extraction master
- `GET /api/v1/documents`: list saved local documents
- `GET /api/v1/documents/{document_id}/extraction-master`: view generated extraction master
- `GET /api/v1/documents/field-catalog/{document_type}`: list expected OCR fields

Uploaded files are saved under the project-level `data` folder.
