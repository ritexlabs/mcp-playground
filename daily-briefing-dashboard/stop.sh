#!/usr/bin/env bash
# Stop the Daily Briefing Dashboard.
# Usage: bash stop.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"
PORT="${PORT:-8080}"

stop_pid() {
  local pid=$1
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    # Wait up to 5 s for a clean exit
    local waited=0
    while kill -0 "$pid" 2>/dev/null && (( waited < 5 )); do
      sleep 1
      (( waited++ ))
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "⚠️  Process did not exit cleanly — sending SIGKILL..."
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "✅ Dashboard stopped (PID $pid)"
  else
    echo "⚠️  Process $pid is no longer running."
  fi
}

# ─── PID file path ───────────────────────────────────────────────────────────
if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  stop_pid "$PID"
  rm -f "$PID_FILE"
  exit 0
fi

# ─── Fallback: find by port ───────────────────────────────────────────────────
echo "No PID file found. Searching for a process on port $PORT..."

if command -v lsof &>/dev/null; then
  FOUND_PID=$(lsof -ti tcp:"$PORT" 2>/dev/null | head -1 || true)
elif command -v fuser &>/dev/null; then
  FOUND_PID=$(fuser "${PORT}/tcp" 2>/dev/null | awk '{print $1}' || true)
else
  FOUND_PID=""
fi

if [[ -n "$FOUND_PID" ]]; then
  echo "Found process on port $PORT (PID $FOUND_PID)"
  stop_pid "$FOUND_PID"
else
  echo "No Dashboard process found on port $PORT. Nothing to stop."
fi
