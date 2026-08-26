#!/usr/bin/env bash
# Deploy all DispoCenter Edge Functions to sxqbmxqnwtrgibfryvqf
set -euo pipefail

export PATH="${HOME}/.local/node/bin:${PATH}"
cd "$(dirname "$0")/.."

PROJECT_REF="sxqbmxqnwtrgibfryvqf"
FUNCTIONS=(
  assign-depot
  plan-tour
  ai-resolve
  upsert-integration
  test-integration
  fetch-imap
  create-admin
  demo-setup
  research-article
  geocode-shipments
)

echo "==> Auth check"
if ! npx supabase projects list >/dev/null 2>&1; then
  echo "Nicht eingeloggt. Bitte zuerst in DIESEM Terminal ausführen:"
  echo "  npx supabase login"
  echo "Danach dieses Skript erneut starten."
  exit 1
fi

echo "==> Link project ${PROJECT_REF}"
npx supabase link --project-ref "${PROJECT_REF}"

echo "==> Deploy ${#FUNCTIONS[@]} functions"
for fn in "${FUNCTIONS[@]}"; do
  echo "---- deploying ${fn}"
  npx supabase functions deploy "${fn}"
done

echo "==> Secrets"
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # Only pull the maps key; never echo the value
  MAPS_KEY="$(grep -E '^VITE_GOOGLE_MAPS_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  set +a
  if [[ -n "${MAPS_KEY}" ]]; then
    npx supabase secrets set "GOOGLE_MAPS_API_KEY=${MAPS_KEY}"
    echo "GOOGLE_MAPS_API_KEY gesetzt (aus VITE_GOOGLE_MAPS_API_KEY)."
  else
    echo "WARN: VITE_GOOGLE_MAPS_API_KEY fehlt in .env — assign-depot nutzt Haversine."
  fi
else
  echo "WARN: keine .env gefunden"
fi

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  npx supabase secrets set "GEMINI_API_KEY=${GEMINI_API_KEY}"
  echo "GEMINI_API_KEY gesetzt (aus Umgebung)."
else
  echo "WARN: GEMINI_API_KEY nicht gesetzt — ai-resolve / research-article brauchen ihn zur Laufzeit."
  echo "  Beispiel: GEMINI_API_KEY=... ./scripts/deploy-edge-functions.sh"
fi

if [[ -n "${SERPER_API_KEY:-}" ]]; then
  npx supabase secrets set "SERPER_API_KEY=${SERPER_API_KEY}"
  echo "SERPER_API_KEY gesetzt."
fi
if [[ -n "${TAVILY_API_KEY:-}" ]]; then
  npx supabase secrets set "TAVILY_API_KEY=${TAVILY_API_KEY}"
  echo "TAVILY_API_KEY gesetzt."
fi

echo "==> secrets list (Namen only)"
npx supabase secrets list

echo "==> Fertig. Smoke-Tests bitte in der App:"
echo "  assign-depot / plan-tour → Kontrollzentrale"
echo "  ai-resolve → Probleme"
echo "  upsert/test-integration → Einstellungen"
echo "  fetch-imap → Kontrollzentrale „Mails abrufen“"
echo "  research-article → ArticleReviewPanel"
