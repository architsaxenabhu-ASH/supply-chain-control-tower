$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backendPath = Join-Path $projectRoot "backend"
$venvPython = Join-Path $backendPath ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Backend virtual environment is missing. Run scripts\start-backend.ps1 first." -ForegroundColor Red
    exit 1
}

Set-Location $backendPath
$env:PYTHONPATH = $backendPath

@'
from app.db.local_persistence import configured_database_url, database_path, init_database
from app.services.warehouse_repository import dashboard_summary, list_goods_receipts, list_inventory_batches

init_database()
summary = dashboard_summary()

print("Database connection OK")
print(f"Database target: {configured_database_url()}")
print(f"Database location: {database_path()}")
print(f"Inventory value: {summary.total_inventory_value}")
print(f"Inventory batches: {len(list_inventory_batches())}")
print(f"Goods receipts: {len(list_goods_receipts())}")
'@ | & $venvPython -
