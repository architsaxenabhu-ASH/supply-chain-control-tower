$ErrorActionPreference = "Stop"

Write-Host "Checking Supply Chain Control Tower environment..." -ForegroundColor Cyan

$python = Get-Command python -ErrorAction SilentlyContinue
$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue

if ($python) {
    Write-Host "Python found: $($python.Source)" -ForegroundColor Green
} elseif ($pyLauncher) {
    Write-Host "Python launcher found: $($pyLauncher.Source)" -ForegroundColor Green
} else {
    Write-Host "Python not found. Install Python 3.11 or newer, then reopen VS Code." -ForegroundColor Red
}

if ($npm) {
    Write-Host "npm found: $($npm.Source)" -ForegroundColor Green
} else {
    Write-Host "npm not found. Install Node.js LTS, then reopen VS Code." -ForegroundColor Red
    Write-Host "Easy Windows command: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    Write-Host "Manual download: https://nodejs.org/en/download/" -ForegroundColor Yellow
}

if (($python -or $pyLauncher) -and $npm) {
    Write-Host "Environment check passed. You can run the backend and frontend scripts." -ForegroundColor Green
} else {
    Write-Host "Environment check did not pass yet. Fix the missing tool above first." -ForegroundColor Yellow
}
