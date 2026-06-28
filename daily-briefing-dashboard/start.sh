#!/usr/bin/env bash
# Start the Daily Briefing Dashboard as a background process.
# Usage: bash start.sh [--port 8080]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_FILE="$SCRIPT_DIR/.server.log"

# ─── Resolve port ───────────────────────────────────────────────────────────
PORT="${PORT:-8080}"
while [[ $# -gt 0 ]]; do
  case $1 in
    --port) PORT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Guard: already running ──────────────────────────────────────────────────
if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID=$(cat "$PID_FILE")
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "⚠️  Dashboard is already running (PID $EXISTING_PID)"
    echo "   http://localhost:$PORT"
    echo "   Run bash stop.sh to stop it."
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

# ─── Check MCP Gateway health ────────────────────────────────────────────────
GATEWAY_URL="${MCP_GATEWAY_URL:-http://127.0.0.1:8000}"
if curl -sf "$GATEWAY_URL/health" > /dev/null 2>&1; then
  echo "✅ MCP Gateway is reachable at $GATEWAY_URL"
else
  echo "⚠️  MCP Gateway not reachable at $GATEWAY_URL"
  echo "   The dashboard will start but will retry the connection every 5 s."
  echo "   To start the gateway: cd ../mcp-gateway && ./start.sh"
fi

# ─── Install dashboard deps if needed ────────────────────────────────────────
if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  echo "📦 Installing dashboard dependencies..."
  (cd "$SCRIPT_DIR" && npm install --silent)
fi

# ─── Launch ──────────────────────────────────────────────────────────────────
echo "🚀 Starting Daily Briefing Dashboard..."
PORT="$PORT" nohup node "$SCRIPT_DIR/server.js" > "$LOG_FILE" 2>&1 &
LAUNCHED_PID=$!
echo "$LAUNCHED_PID" > "$PID_FILE"

sleep 1

if ! kill -0 "$LAUNCHED_PID" 2>/dev/null; then
  echo "❌ Dashboard failed to start. Check the log:"
  echo "   tail -20 $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi

echo ""
echo "✅ Dashboard running (PID $LAUNCHED_PID)"
echo "   URL:  http://localhost:$PORT"
echo "   Log:  tail -f $LOG_FILE"
echo "   Stop: bash \"$SCRIPT_DIR/stop.sh\""
echo ""
