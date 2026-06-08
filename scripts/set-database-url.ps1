param(
    [string]$DatabaseUrl,
    [string]$EnvPath,
    [switch]$SkipCheck
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backendPath = Join-Path $projectRoot "backend"

if (-not $EnvPath) {
    $EnvPath = Join-Path $backendPath ".env"
}

function ConvertFrom-SecureStringToPlainText {
    param([securestring]$SecureValue)

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}

function ConvertTo-EnvQuotedValue {
    param([string]$Value)

    return $Value.Replace("\", "\\").Replace('"', '\"')
}

if (-not $DatabaseUrl) {
    Write-Host "Paste the database connection string. It will be hidden while you type." -ForegroundColor Cyan
    Write-Host "Example format: postgresql://USER:PASSWORD@HOST:5432/DATABASE" -ForegroundColor Yellow
    $secureDatabaseUrl = Read-Host "DATABASE_URL" -AsSecureString
    $DatabaseUrl = ConvertFrom-SecureStringToPlainText $secureDatabaseUrl
}

if (-not $DatabaseUrl -or -not $DatabaseUrl.Trim()) {
    Write-Host "DATABASE_URL was empty. Nothing was changed." -ForegroundColor Red
    exit 1
}

$DatabaseUrl = $DatabaseUrl.Trim().Trim('"').Trim("'")

if (
    -not $DatabaseUrl.StartsWith("postgresql://") -and
    -not $DatabaseUrl.StartsWith("postgres://") -and
    -not $DatabaseUrl.StartsWith("postgresql+psycopg://") -and
    -not $DatabaseUrl.StartsWith("sqlite:///")
) {
    Write-Host "Unsupported database URL format." -ForegroundColor Red
    Write-Host "Use postgresql://, postgres://, postgresql+psycopg://, or sqlite:///." -ForegroundColor Yellow
    exit 1
}

$envDirectory = Split-Path -Parent $EnvPath
if ($envDirectory -and -not (Test-Path $envDirectory)) {
    New-Item -ItemType Directory -Path $envDirectory | Out-Null
}

$safeDatabaseUrl = ConvertTo-EnvQuotedValue $DatabaseUrl.Trim()

$content = @"
APP_NAME="Supply Chain Control Tower"
APP_VERSION="0.1.0"
DATABASE_URL="$safeDatabaseUrl"
"@

Set-Content -LiteralPath $EnvPath -Value $content -Encoding UTF8

Write-Host "Saved database settings to backend\\.env" -ForegroundColor Green
Write-Host "The file is ignored by Git, so it will not be pushed to GitHub." -ForegroundColor Green

if (-not $SkipCheck) {
    Write-Host "Checking database connection..." -ForegroundColor Cyan
    & (Join-Path $projectRoot "scripts\check-database.ps1")
}
