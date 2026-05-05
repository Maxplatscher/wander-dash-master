param(
  [switch]$NoDb
)

$ErrorActionPreference = "Stop"

Write-Host "== Easy Planning Dev Start ==" -ForegroundColor Cyan

if (-not $NoDb) {
  Write-Host "1) PostgreSQL via Docker Compose starten ..." -ForegroundColor Yellow
  docker compose up -d db
}

Write-Host "2) Backend lokal starten (uvicorn --reload) ..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\..\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
