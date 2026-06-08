# Git, GitHub, And Data Backup

## What Git Should Store

Git should store the application source code and project documents:

- Backend code
- Frontend code
- Database schema
- Deployment files
- Roadmap and workflow documents
- Start guides

This lets us restore the application code later and continue development from any computer.

## What Git Should Not Store

Git should not be the main storage place for live operational data:

- Uploaded invoices
- Packing lists
- AWBs
- SQLite database files
- Local OCR extracts
- Customer, supplier, batch, or inventory transaction records

Reason: these records can contain confidential business data and medical-device supply chain information. They need controlled access, backups, and later PostgreSQL database storage.

## Current Local Data Storage

The local prototype stores runtime data here:

- `data/control_tower.db`
- `data/documents.json`
- `data/uploads`
- `data/extraction_masters`
- `data/master_candidates`

These paths are intentionally ignored by Git.

## Correct Future Setup

For production:

1. Code goes to a private GitHub repository.
2. Runtime data goes to PostgreSQL.
3. Uploaded documents go to controlled document storage.
4. PostgreSQL and documents get scheduled backups.
5. Access is controlled by email-based RBAC.

## Simple Rule

Git is for the app.

Database and secure document storage are for business data.
