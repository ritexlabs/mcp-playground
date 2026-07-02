#!/usr/bin/env python3
"""
Unified stack management — start, stop, restart, or check status
of the MCP Gateway and Daily Briefing Dashboard.
Works on Windows, macOS, and Linux.

Usage:
    python scripts/start_dashboard.py start
    python scripts/start_dashboard.py stop
    python scripts/start_dashboard.py restart
    python scripts/start_dashboard.py status
"""

import os
import subprocess
import sys
from pathlib import Path
from urllib.request import urlopen

REPO_DIR      = Path(__file__).resolve().parent.parent
GATEWAY_DIR   = REPO_DIR / "mcp-gateway"
DASHBOARD_DIR = REPO_DIR / "daily-briefing-dashboard"

GATEWAY_PID_FILE   = GATEWAY_DIR   / ".gateway.pid"
DASHBOARD_PID_FILE = DASHBOARD_DIR / ".server.pid"

GATEWAY_PORT   = int(os.environ.get("MCP_PORT", 8000))
DASHBOARD_PORT = int(os.environ.get("PORT", 8080))
GATEWAY_URL    = os.environ.get("MCP_GATEWAY_URL", f"http://127.0.0.1:{GATEWAY_PORT}")
DASHBOARD_URL  = f"http://localhost:{DASHBOARD_PORT}"


# ── Terminal colour helpers ───────────────────────────────────────────────────

def _enable_ansi() -> None:
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(
                ctypes.windll.kernel32.GetStdHandle(-11), 7
            )
        except Exception:
            pass

_enable_ansi()

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m"

def ok(msg: str)   -> None: print(_c("32", f"  ✓  {msg}"))
def warn(msg: str) -> None: print(_c("33", f"  ⚠  {msg}"))
def err(msg: str)  -> None: print(_c("31", f"  ✗  {msg}"), file=sys.stderr)
def info(msg: str) -> None: print(f"     {msg}")

def head(msg: str) -> None:
    print(f"\n{_c('1;36', msg)}")
    print("─" * 54)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_running(pid: int) -> bool:
    try:
        if sys.platform == "win32":
            r = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV"],
                capture_output=True, text=True,
            )
            return str(pid) in r.stdout
        else:
            os.kill(pid, 0)
            return True
    except (OSError, ProcessLookupError):
        return False


def _read_pid(pid_file: Path) -> int | None:
    try:
        return int(pid_file.read_text().strip())
    except Exception:
        return None


def _health(url: str) -> bool:
    try:
        with urlopen(f"{url}/health", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _run_script(script: Path, *extra_args: str) -> bool:
    """Run a Python management script with the same interpreter as this one."""
    result = subprocess.run(
        [sys.executable, str(script)] + list(extra_args),
        check=False,
    )
    return result.returncode == 0


# ── Commands ──────────────────────────────────────────────────────────────────

def do_start() -> None:
    head("Starting MCP Gateway")
    gw_ok = _run_script(GATEWAY_DIR / "start.py")

    head("Starting Daily Briefing Dashboard")
    db_ok = _run_script(DASHBOARD_DIR / "start.py")

    print()
    if gw_ok and db_ok:
        ok("Full stack is up")
    else:
        warn("One or more services failed to start — check output above")
    info(f"Gateway   : {GATEWAY_URL}")
    info(f"Dashboard : {DASHBOARD_URL}")
    print()


def do_stop() -> None:
    head("Stopping Daily Briefing Dashboard")
    _run_script(DASHBOARD_DIR / "stop.py")

    head("Stopping MCP Gateway")
    _run_script(GATEWAY_DIR / "stop.py")

    print()
    ok("Stack stopped")
    print()


def do_status() -> None:
    gw_pid = _read_pid(GATEWAY_PID_FILE)
    db_pid = _read_pid(DASHBOARD_PID_FILE)

    print(f"\n{_c('1', 'Stack status')}")
    print("─" * 36)

    if gw_pid and _is_running(gw_pid):
        live = "online" if _health(GATEWAY_URL) else "starting…"
        print(f"  Gateway   {_c('32', '● running')}  PID {gw_pid:>6}  {GATEWAY_URL}  ({live})")
    else:
        print(f"  Gateway   {_c('31', '○ stopped')}")

    if db_pid and _is_running(db_pid):
        print(f"  Dashboard {_c('32', '● running')}  PID {db_pid:>6}  {DASHBOARD_URL}")
    else:
        print(f"  Dashboard {_c('31', '○ stopped')}")

    print()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "start":
        do_start()
    elif cmd == "stop":
        do_stop()
    elif cmd == "restart":
        do_stop()
        do_start()
    elif cmd == "status":
        do_status()
    else:
        prog = Path(sys.argv[0]).name
        print(f"Usage: python {prog} {{start|stop|restart|status}}")
        print()
        print("  start    Start gateway then dashboard")
        print("  stop     Stop dashboard then gateway")
        print("  restart  Stop then start the full stack")
        print("  status   Show running state of both services")
        sys.exit(1)


if __name__ == "__main__":
    main()
