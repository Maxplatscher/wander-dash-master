@echo off
setlocal
echo == Easy Planning Dev Start ==
echo 1) PostgreSQL via Docker Compose starten ...
docker compose up -d db
echo 2) Backend lokal starten (uvicorn --reload) ...
cd /d "%~dp0..\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
endlocal
