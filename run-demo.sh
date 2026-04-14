#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSC_JS="$ROOT_DIR/node_modules/typescript/bin/tsc"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20+ is required (recommended 22+). Current: $(node -v)" >&2
  exit 1
fi

if [[ ! -f "$TSC_JS" ]]; then
  echo "Local TypeScript compiler not found. Run 'npm install' first." >&2
  exit 1
fi

node "$TSC_JS" -p "$ROOT_DIR/tsconfig.build.json"
node --env-file="$ROOT_DIR/.env" "$ROOT_DIR/dist/demo.js" "$@"
