$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backendPath = Join-Path $projectRoot "backend"
$venvPath = Join-Path $backendPath ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"

Set-Location $backendPath

if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCommand = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCommand = "py"
} else {
    Write-Host "Python is not installed or not available in VS Code terminal." -ForegroundColor Red
    Write-Host "Install Python 3.11 or newer, then reopen VS Code." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating backend virtual environment..." -ForegroundColor Cyan
    & $pythonCommand -m venv .venv
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements.txt

Write-Host "Starting backend at http://127.0.0.1:8000" -ForegroundColor Green
& $venvPython -m uvicorn app.main:app --reload

