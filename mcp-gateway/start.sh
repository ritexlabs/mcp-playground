#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE=".gateway.pid"
LOG_FILE="logs/gateway.log"
HOST="${MCP_HOST:-127.0.0.1}"
PORT="${MCP_PORT:-8000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p logs

if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Gateway already running (PID $OLD_PID) at http://$HOST:$PORT${NC}"
        exit 0
    fi
    rm -f "$PID_FILE"
fi

if [ ! -d .venv ]; then
    echo -e "${RED}❌ .venv not found. Run $SCRIPT_DIR/setup.sh first.${NC}"
    exit 1
fi

if [ ! -f .env ]; then
    echo -e "${RED}❌ .env not found. Copy .env.example to .env and fill in credentials.${NC}"
    exit 1
fi

echo "🚀 Starting MCP Gateway on http://$HOST:$PORT ..."

nohup .venv/bin/uvicorn src.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --log-level info \
    >> "$LOG_FILE" 2>&1 &

GATEWAY_PID=$!
echo "$GATEWAY_PID" > "$PID_FILE"

for i in $(seq 1 10); do
    sleep 0.5
    if curl -sf "http://$HOST:$PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Gateway is up (PID $GATEWAY_PID)${NC}"
        echo "   Health: http://$HOST:$PORT/health"
        echo "   SSE:    http://$HOST:$PORT/sse"
        echo "   Logs:   $SCRIPT_DIR/$LOG_FILE"
        exit 0
    fi
done

echo -e "${RED}❌ Gateway did not start within 5 s. Check $SCRIPT_DIR/$LOG_FILE for errors.${NC}"
rm -f "$PID_FILE"
exit 1
