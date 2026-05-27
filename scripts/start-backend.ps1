# JZPT backend - unified startup (always from project root)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Error "Virtual env not found: $VenvPython`nRun: python -m venv .venv && .\.venv\Scripts\pip install fastapi uvicorn feedparser python-dotenv sqlalchemy google-generativeai"
}

# Free port 8000 if occupied
$listeners = netstat -ano | Select-String ':8000\s+.*LISTENING'
foreach ($line in $listeners) {
    $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
    $pid = $parts[-1]
    if ($pid -match '^\d+$') {
        Write-Host "Stopping process on port 8000 (PID $pid)..."
        taskkill /PID $pid /F 2>$null | Out-Null
    }
}

Write-Host "Starting backend on http://127.0.0.1:8000 (DB: backend/jzpt.db)"
& $VenvPython -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
