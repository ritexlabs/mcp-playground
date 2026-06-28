#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE=".gateway.pid"
HOST="${MCP_HOST:-127.0.0.1}"
PORT="${MCP_PORT:-8000}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm -f "$PID_FILE"
        echo -e "${GREEN}✅ Gateway stopped (PID $PID)${NC}"
        exit 0
    else
        rm -f "$PID_FILE"
        echo -e "${YELLOW}⚠️  PID file was stale — already stopped${NC}"
        exit 0
    fi
fi

# Fallback: kill by port
FOUND=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [ -n "$FOUND" ]; then
    echo "$FOUND" | xargs kill 2>/dev/null || true
    echo -e "${GREEN}✅ Gateway process on port $PORT stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Gateway is not running${NC}"
fi
