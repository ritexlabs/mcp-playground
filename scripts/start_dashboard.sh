#!/usr/bin/env bash
# dev.sh — start or stop the full MCP Playground stack
#
# Usage:
#   ./scripts/dev.sh start   # start gateway, then dashboard
#   ./scripts/dev.sh stop    # stop dashboard, then gateway
#   ./scripts/dev.sh restart # stop then start
#   ./scripts/dev.sh status  # show running state

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY_DIR="$REPO_DIR/mcp-gateway"
DASHBOARD_DIR="$REPO_DIR/daily-briefing-dashboard"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────

print_header() {
  echo ""
  echo -e "${CYAN}${BOLD}$1${NC}"
  echo -e "${CYAN}$(printf '─%.0s' {1..50})${NC}"
}

gateway_pid() {
  local pid_file="$GATEWAY_DIR/.gateway.pid"
  [[ -f "$pid_file" ]] && cat "$pid_file" || echo ""
}

dashboard_pid() {
  local pid_file="$DASHBOARD_DIR/.server.pid"
  [[ -f "$pid_file" ]] && cat "$pid_file" || echo ""
}

is_running() {
  local pid=$1
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# ── Start ─────────────────────────────────────────────────────────────────────

do_start() {
  print_header "Starting MCP Gateway"
  bash "$GATEWAY_DIR/start.sh"

  print_header "Starting Daily Briefing Dashboard"
  bash "$DASHBOARD_DIR/start.sh"

  echo ""
  echo -e "${GREEN}${BOLD}✅ Stack is up${NC}"
  echo -e "   Gateway:   http://127.0.0.1:8000"
  echo -e "   Dashboard: http://localhost:8080"
  echo ""
}

# ── Stop ──────────────────────────────────────────────────────────────────────

do_stop() {
  print_header "Stopping Daily Briefing Dashboard"
  bash "$DASHBOARD_DIR/stop.sh" || true

  print_header "Stopping MCP Gateway"
  bash "$GATEWAY_DIR/stop.sh" || true

  echo ""
  echo -e "${GREEN}${BOLD}✅ Stack stopped${NC}"
  echo ""
}

# ── Status ────────────────────────────────────────────────────────────────────

do_status() {
  local gw_pid
  gw_pid=$(gateway_pid)
  local db_pid
  db_pid=$(dashboard_pid)

  echo ""
  echo -e "${BOLD}Stack status${NC}"
  echo -e "$(printf '─%.0s' {1..30})"

  if is_running "$gw_pid"; then
    echo -e "  Gateway   ${GREEN}● running${NC}  (PID $gw_pid)  http://127.0.0.1:8000"
  else
    echo -e "  Gateway   ${RED}○ stopped${NC}"
  fi

  if is_running "$db_pid"; then
    echo -e "  Dashboard ${GREEN}● running${NC}  (PID $db_pid)  http://localhost:8080"
  else
    echo -e "  Dashboard ${RED}○ stopped${NC}"
  fi
  echo ""
}

# ── Entry point ───────────────────────────────────────────────────────────────

CMD="${1:-}"

case "$CMD" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; do_start ;;
  status)  do_status ;;
  *)
    echo -e "Usage: $(basename "$0") {start|stop|restart|status}"
    echo ""
    echo "  start    Start gateway then dashboard"
    echo "  stop     Stop dashboard then gateway"
    echo "  restart  Stop then start the full stack"
    echo "  status   Show running state of both services"
    exit 1
    ;;
esac
