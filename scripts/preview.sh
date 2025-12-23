#!/usr/bin/env bash
# Simple preview helper: starts the no-cache dev server with live reload.
# Usage: ./scripts/preview.sh
set -euo pipefail
PORT=${1:-8080}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Serving $ROOT_DIR on http://localhost:$PORT"
PORT="$PORT" exec node "$ROOT_DIR/scripts/dev.mjs"
