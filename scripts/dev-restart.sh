#!/usr/bin/env bash
# dev-restart.sh — Cleanly restart the OutreachOS dev server
# Usage: ./scripts/dev-restart.sh [--clean]
#   --clean : also delete .next, node_modules/.cache, .turbo caches

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"

echo "[dev-restart] Killing existing Next.js dev processes..."
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "turbo run dev" 2>/dev/null || true

# Wait for port 3000 to free up
for i in {1..10}; do
  if ! lsof -i :3000 >/dev/null 2>&1; then
    break
  fi
  echo "[dev-restart] Waiting for port 3000 to free... ($i/10)"
  sleep 1
done

# Force-kill anything still on 3000
PIDS=$(lsof -ti :3000 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
  echo "[dev-restart] Force-killing stubborn processes on :3000: $PIDS"
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

if [[ "${1:-}" == "--clean" ]]; then
  echo "[dev-restart] Clearing Next.js & Turbo caches..."
  rm -rf "$WEB_DIR/.next" || true
  rm -rf "$WEB_DIR/node_modules/.cache" || true
  rm -rf "$ROOT_DIR/.turbo" || true
fi

echo "[dev-restart] Starting dev server..."
cd "$WEB_DIR"
exec pnpm dev
