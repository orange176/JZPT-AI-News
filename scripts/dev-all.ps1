# JZPT full-stack dev: backend (8000) + Next.js (3000)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Error "Virtual env not found: $VenvPython`nRun: python -m venv .venv && .\.venv\Scripts\pip install -r backend\requirements.txt"
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

Write-Host "Starting backend on http://127.0.0.1:8000 ..."
$backend = Start-Process -FilePath $VenvPython `
    -ArgumentList @("-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000") `
    -PassThru -WindowStyle Hidden

function Stop-Backend {
    if ($backend -and -not $backend.HasExited) {
        Write-Host "Stopping backend (PID $($backend.Id))..."
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
}

try {
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -TimeoutSec 1 -UseBasicParsing
            $ready = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    if (-not $ready) {
        Write-Warning "Backend did not respond within 30s; Next.js will still start."
    } else {
        Write-Host "Backend is ready."
    }

    Write-Host "Starting Next.js on http://localhost:3000 ..."
    npm run dev
} finally {
    Stop-Backend
}
