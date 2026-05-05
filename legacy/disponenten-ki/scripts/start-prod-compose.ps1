$ErrorActionPreference = "Stop"

Write-Host "== Easy Planning Compose (produktionsnah) ==" -ForegroundColor Cyan
Write-Host "Baut Backend-Image und startet DB + API ..." -ForegroundColor Yellow

docker compose up -d --build db backend

Write-Host "Fertig. Health-Check:" -ForegroundColor Green
Write-Host "  http://127.0.0.1:8000/health" -ForegroundColor Green
