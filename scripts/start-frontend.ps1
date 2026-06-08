$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$frontendPath = Join-Path $projectRoot "frontend"

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue

if (-not $npm) {
    Write-Host "npm is not installed or not available in VS Code terminal." -ForegroundColor Red
    Write-Host "Install Node.js LTS, then reopen VS Code." -ForegroundColor Yellow
    Write-Host "Easy Windows command: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    Write-Host "Manual download: https://nodejs.org/en/download/" -ForegroundColor Yellow
    exit 1
}

Set-Location $frontendPath

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    & $npm.Source install
}

Write-Host "Starting frontend. Open the local website link shown below." -ForegroundColor Green
& $npm.Source run dev
