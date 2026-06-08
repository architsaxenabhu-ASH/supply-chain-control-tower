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
from urllib.parse import urlsplit, urlunsplit

from app.db.local_persistence import configured_database_url, database_path, init_database
from app.services.warehouse_repository import dashboard_summary, list_goods_receipts, list_inventory_batches


def redact_database_url(url: str) -> str:
    if "@" not in url:
        return url
    parts = urlsplit(url)
    if not parts.username:
        return url
    host = parts.hostname or ""
    port = f":{parts.port}" if parts.port else ""
    netloc = f"{parts.username}:***@{host}{port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


init_database()
summary = dashboard_summary()
database_url = configured_database_url()

print("Database connection OK")
print(f"Database target: {redact_database_url(database_url)}")
if database_url.startswith("sqlite:///"):
    print(f"Database location: {database_path()}")
print(f"Inventory value: {summary.total_inventory_value}")
print(f"Inventory batches: {len(list_inventory_batches())}")
print(f"Goods receipts: {len(list_goods_receipts())}")
'@ | & $venvPython -
