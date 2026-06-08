# Supply Chain Control Tower: Phase 1 Start Guide

## Your Role

You are the business logic owner.

You tell the system:

- What document is being uploaded
- Which fields matter
- Which fields are mandatory
- What should happen after approval
- What exceptions should stop the transaction

## My Role

I convert your logic into:

- Screens
- Tables
- Workflows
- Extraction rules
- Validation rules
- Transaction creation logic

## Phase 1 We Are Building

The first app module is the Document Upload Portal.

It will:

1. Let you choose the document type.
2. Let you upload the document.
3. Save the document locally on your computer.
4. Generate an extraction master.
5. Generate master candidates.
6. Show the extracted fields for review.

## First Three Documents

- Commercial Invoice
- Packing List
- Air Waybill

## Where Files Are Saved

The app stores files inside the project folder:

- Original uploads: `data/uploads`
- Extraction masters: `data/extraction_masters`
- Master candidates: `data/master_candidates`
- Document list: `data/documents.json`

## Important Note About OCR

In Phase 1, the app creates the extraction master and reads values when the document has readable text.

For scanned PDFs, JPG, and PNG images, we will connect a proper OCR engine later.

## Important Note About Masters

The app generates pending master candidates, not approved masters.

Examples:

- Supplier candidate
- Customer candidate
- Product candidate
- Carrier candidate
- UOM candidate
- Currency candidate
- Country candidate

This is safer because a human can validate the master before it becomes official.

## What Comes Next

After Phase 1, we build Phase 2:

1. Validation screen
2. Correct extracted values
3. Approve fields
4. Create inbound shipment
5. Create inventory movement

## How The App Will Be Started

Once Python and Node.js package tools are available, the backend starts from the `backend` folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The frontend starts from the `frontend` folder:

```powershell
npm install
npm run dev
```

Then open the local website shown by the frontend command.

## Current Setup Status

The project files are ready, but this shell currently does not show `python`, `npm`, or `uvicorn` on the system path. That means the app cannot be launched here until those tools are installed or enabled.
