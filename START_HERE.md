# Start Here

This project is the Supply Chain Control Tower.

You do not need to write code. Your job is to explain the business logic. Codex will write the code.

## What We Are Building First

Phase 1 is the Document Upload Portal.

It will:

1. Let you choose document type.
2. Let you upload a document.
3. Save the file locally on your computer.
4. Generate an extraction master.
5. Generate pending master candidates.
6. Prepare the data for validation.
7. Post validated imports into inventory through Goods Receipt.

The local prototype now also saves transaction data in:

- `data/control_tower.db`

That database is why inventory and receipts can survive a backend restart.

## First Three Document Types

- Commercial Invoice
- Packing List
- Air Waybill

## Where Uploaded Files Will Be Stored

Uploaded files will be saved inside this project folder:

- `data/uploads`
- `data/extraction_masters`
- `data/master_candidates`
- `data/documents.json`

## How To Start In VS Code

Open the VS Code terminal from:

`Terminal -> New Terminal`

## If npm Is Missing

`npm` is the Node.js package manager. We need it to install and run the React frontend.

On Windows, the easiest install command is:

```powershell
winget install OpenJS.NodeJS.LTS
```

After installation, close VS Code and open it again. Then check:

```powershell
node -v
npm.cmd -v
```

Then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

If the check passes, open two VS Code terminals.

In the first terminal, run:

```powershell
.\scripts\start-backend.ps1
```

In the second terminal, run:

```powershell
.\scripts\start-frontend.ps1
```

If Windows blocks either start script, run the same command with the one-time bypass:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
```

The frontend command will show a local website link. Open that link in your browser.

## Your Role

You tell Codex:

- Which fields are mandatory
- Which fields should create masters
- What should happen when a field is missing
- What should happen after approval

## Codex Role

Codex will:

- Write the code
- Build the screens
- Create the backend logic
- Explain everything in simple business language
