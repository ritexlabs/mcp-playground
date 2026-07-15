#!/usr/bin/env python3
"""
Unified stack manager — start/stop/restart/status for the full MCP Playground.

Usage (from anywhere in the repo):
    python scripts/start_dashboard.py start
    python scripts/start_dashboard.py stop
    python scripts/start_dashboard.py status
    python scripts/start_dashboard.py restart
"""

import subprocess
import sys
from pathlib import Path

REPO_DIR      = Path(__file__).resolve().parent.parent
GATEWAY_SCRIPT  = REPO_DIR / "mcp-gateway" / "mcp_gateway.py"
DASHBOARD_SCRIPT = REPO_DIR / "daily-briefing-dashboard" / "daily_dashboard.py"


def _run(script: Path, cmd: str) -> int:
    return subprocess.run([sys.executable, str(script), cmd]).returncode


def do_start() -> None:
    gateway_dir = REPO_DIR / "mcp-gateway"
    venv_dir    = gateway_dir / ".venv"
    env_file    = gateway_dir / ".env"

    if not venv_dir.exists() or not env_file.exists():
        print("\n  Running gateway setup first...\n")
        rc = _run(GATEWAY_SCRIPT, "setup")
        if rc != 0:
            sys.exit(rc)

    rc = _run(GATEWAY_SCRIPT, "start")
    if rc != 0:
        sys.exit(rc)

    rc = _run(DASHBOARD_SCRIPT, "start")
    sys.exit(rc)


def do_stop() -> None:
    _run(DASHBOARD_SCRIPT, "stop")
    _run(GATEWAY_SCRIPT, "stop")


def do_status() -> None:
    _run(GATEWAY_SCRIPT, "status")
    _run(DASHBOARD_SCRIPT, "status")


def do_restart() -> None:
    do_stop()
    do_start()


COMMANDS = {
    "start":   do_start,
    "stop":    do_stop,
    "status":  do_status,
    "restart": do_restart,
}


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd in COMMANDS:
        COMMANDS[cmd]()
    else:
        prog = Path(sys.argv[0]).name
        print(f"\nUsage: python scripts/{prog} {{start|stop|status|restart}}\n")
        print("  start    Setup (first run) → start gateway → start dashboard → open browser")
        print("  stop     Stop dashboard then gateway")
        print("  status   Show running state for both services")
        print("  restart  Stop then start")
        sys.exit(1)


if __name__ == "__main__":
    main()
