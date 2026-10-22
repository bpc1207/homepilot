#!/usr/bin/env bash
# Local smoke test without Docker: needs a Postgres at $DATABASE_URL. Uses fs storage + console mail.
set -euo pipefail
export DATABASE_URL="${DATABASE_URL:-postgresql://denial:denial@localhost:5432/denialfighter}"
export APP_MASTER_KEY="${APP_MASTER_KEY:-$(openssl rand -base64 32)}" KEY_DRIVER=local STORAGE_DRIVER=fs MAIL_DRIVER=console ALLOW_INSECURE_DEV=true JOBS_DRIVER=inline APP_URL=http://localhost:3000
mkdir -p .data && npx prisma migrate deploy >/dev/null && npm run build >/dev/null
setsid npx next start > .data/server.log 2>&1 & SERVER=$!
trap 'kill -- -$SERVER 2>/dev/null || kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf localhost:3000 >/dev/null && break; sleep 1; done
npx playwright test
