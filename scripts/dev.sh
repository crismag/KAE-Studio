#!/usr/bin/env bash
#
# Run Studio locally: backend, frontend, and CIE, against a KAE-Memory of your
# choosing.
#
#   ./scripts/dev.sh                  # against the deployed Memory
#   KAE_MEMORY_URL=http://127.0.0.1:8000 ./scripts/dev.sh
#
# Both halves run on 127.0.0.1. Different ports are a different *origin* but the
# same *site*, which is why a SameSite=lax session cookie is still sent — the
# deployment needed no cookie relaxation and neither does this.
#
# Configuration lives in .env.dev, which is gitignored. It is created on first
# run with a generated session secret and password; edit it afterwards.
#
# Bedrock comes from your AWS profile, so CIE needs credentials that can invoke
# a model. Without them a turn returns 503 and says so — it does not fall back
# to something that reads like an interview.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=${ENV_FILE:-.env.dev}

if [ ! -f "$ENV_FILE" ]; then
  echo "== creating $ENV_FILE"
  cat > "$ENV_FILE" <<ENV
# Where durable knowledge lives. The deployed instance by default: developing
# against real data beats developing against an empty database, and Studio
# reaches Memory server-to-server with a bearer token, so nothing about this
# involves your browser.
KAE_MEMORY_URL=https://kae.crishub.com
KAE_MEMORY_TOKEN=REPLACE_ME

STUDIO_SESSION_SECRET=$(openssl rand -hex 32)
STUDIO_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | head -c 18)
STUDIO_OPERATOR=dev

STUDIO_HOST=127.0.0.1
STUDIO_PORT=8100
# Off for local http. The default is on, because inferring it from the bind
# address is what put a session cookie on a public deployment without it.
STUDIO_SECURE_COOKIES=0

# Bedrock, for CIE.
AWS_REGION=ca-central-1
ENV
  echo "   put your KAE-Memory token in $ENV_FILE, then run this again"
  echo "   password: $(grep STUDIO_PASSWORD "$ENV_FILE" | cut -d= -f2)"
  exit 1
fi

set -a; . "./$ENV_FILE"; set +a

if [ "${KAE_MEMORY_TOKEN}" = "REPLACE_ME" ]; then
  echo "!! KAE_MEMORY_TOKEN is unset in $ENV_FILE" >&2
  exit 1
fi

BACKEND_DIR=backend
if [ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]; then
  echo "== creating the backend environment"
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/pip" -q install -e "$BACKEND_DIR" -e ../cris-cie-slim 'anthropic>=0.40' boto3
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "== backend  http://127.0.0.1:${STUDIO_PORT}"
"$BACKEND_DIR/.venv/bin/uvicorn" kae_studio.api:app_from_environment --factory \
  --host 127.0.0.1 --port "${STUDIO_PORT}" --reload &

echo "== frontend http://127.0.0.1:5173"
# Polling because this machine is at its inotify instance limit and vite's
# watcher fails with EMFILE otherwise. Raise fs.inotify.max_user_instances to
# drop this.
CHOKIDAR_USEPOLLING=${CHOKIDAR_USEPOLLING:-true} \
VITE_STUDIO_API="http://127.0.0.1:${STUDIO_PORT}" \
  npx vite --host 127.0.0.1 --port 5173 --strictPort &

echo
echo "   password: ${STUDIO_PASSWORD}"
echo "   memory:   ${KAE_MEMORY_URL}"
echo "   ctrl-c stops both"
wait
