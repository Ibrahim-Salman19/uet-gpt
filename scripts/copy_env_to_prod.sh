#!/bin/bash
# One-off migration helper (docs/SHIP.md Step 4): copies env vars that are
# tied to a shared external provider account (Gemini/Cloudflare/Pinecone/
# Groq keys, arbitrary internal secrets we mint ourselves) from local dev's
# .env.local into the new production Convex deployment. Deliberately does
# NOT print any value - `npx convex env set` takes the value as an argv
# argument, never echoed here.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
TARGET_ENV_FILE=".env.prod.deploy.local"

# Reusable as-is: same external-provider account regardless of which Convex
# deployment calls it, or an internal secret we define ourselves (fine to
# reuse - not deployment-identity-bearing).
KEYS=(
  ADMIN_BOOTSTRAP_EMAIL
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  CONVEX_AUTH_TOKEN
  GEMINI_API_KEY
  GEMINI_API_KEY_1
  GEMINI_API_KEY_2
  GROQ_API_KEY
  PINECONE_API_KEY
  CRAWL_WEBHOOK_SECRET
  CRON_SECRET
  NEXT_PUBLIC_APP_URL
)

for key in "${KEYS[@]}"; do
  value=$(grep "^${key}=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
  if [ -z "$value" ]; then
    echo "SKIP $key (empty or not found in $ENV_FILE)"
    continue
  fi
  npx convex env set "$key" "$value" --env-file "$TARGET_ENV_FILE" > /dev/null
  echo "SET  $key"
done

# Override: local dev deliberately uses "convex" (no Pinecone/Gemini calls);
# production must use the Pinecone dense channel this whole migration exists
# to enable.
npx convex env set KNOWLEDGE_STORE_BACKEND "pinecone" --env-file "$TARGET_ENV_FILE" > /dev/null
echo "SET  KNOWLEDGE_STORE_BACKEND=pinecone (override, not copied from local)"
