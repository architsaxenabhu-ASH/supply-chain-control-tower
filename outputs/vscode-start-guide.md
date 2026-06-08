# VS Code Start Guide

Open this folder in VS Code:

`C:\Users\ARCHIT\Documents\Codex\2026-06-07\project-handover-project-name-supply-chain`

Then open:

`START_HERE.md`

Run this first:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

If npm is missing, install Node.js LTS. npm comes with Node.js.

Easy Windows command:

```powershell
winget install OpenJS.NodeJS.LTS
```

After installing, close VS Code, open it again, and check:

```powershell
node -v
npm.cmd -v
```

If the check passes, start the backend:

```powershell
.\scripts\start-backend.ps1
```

Then open another VS Code terminal and start the frontend:

```powershell
.\scripts\start-frontend.ps1
```

If Windows blocks a script, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
```

Your job is business logic. Codex will handle the code.

First business rules have also been added in:

`docs/mandatory-field-rules.md`

Sample files for your first upload test:

- `outputs/sample-commercial-invoice.csv`
- `outputs/sample-packing-list.csv`
- `outputs/sample-air-waybill.csv`
