#!/usr/bin/env bash
# Simple preview helper: serves the `public/` directory on port 8080
# Usage: ./scripts/preview.sh
set -euo pipefail
PORT=${1:-8080}
PUBLIC_DIR="$(cd "$(dirname "$0")/.." && pwd)/public"
if [ ! -d "$PUBLIC_DIR" ]; then
  echo "public directory not found: $PUBLIC_DIR"
  exit 1
fi
echo "Serving $PUBLIC_DIR on http://localhost:$PORT"
python3 -m http.server "$PORT" --directory "$PUBLIC_DIR"
