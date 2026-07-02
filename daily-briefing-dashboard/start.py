#!/usr/bin/env python3
"""
Start the Daily Briefing Dashboard as a background process.
Works on Windows, macOS, and Linux.

Usage:
    python start.py [--port PORT] [--gateway-url URL]
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

SCRIPT_DIR = Path(__file__).resolve().parent
PID_FILE   = SCRIPT_DIR / ".server.pid"
LOG_FILE   = SCRIPT_DIR / ".server.log"
SERVER_JS  = SCRIPT_DIR / "server.js"

DEFAULT_PORT        = 8080
DEFAULT_GATEWAY_URL = "http://127.0.0.1:8000"


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


# ── Process helpers ───────────────────────────────────────────────────────────

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


def _read_pid() -> int | None:
    try:
        return int(PID_FILE.read_text().strip())
    except Exception:
        return None


def _health(url: str) -> bool:
    try:
        with urlopen(url, timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _node_available() -> bool:
    try:
        r = subprocess.run(
            ["node", "--version"], capture_output=True, text=True
        )
        return r.returncode == 0
    except FileNotFoundError:
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Start Daily Briefing Dashboard")
    parser.add_argument(
        "--port", type=int,
        default=int(os.environ.get("PORT", DEFAULT_PORT)),
    )
    parser.add_argument(
        "--gateway-url",
        default=os.environ.get("MCP_GATEWAY_URL", DEFAULT_GATEWAY_URL),
    )
    args = parser.parse_args()
    port        = args.port
    gateway_url = args.gateway_url

    # ── Pre-flight checks ────────────────────────────────────────────────────
    if not _node_available():
        err("node is not found in PATH.")
        info("Install Node.js 18+ from https://nodejs.org/ and reopen your terminal.")
        sys.exit(1)

    if not SERVER_JS.exists():
        err(f"server.js not found at {SERVER_JS}")
        sys.exit(1)

    # ── Already running? ─────────────────────────────────────────────────────
    existing = _read_pid()
    if existing and _is_running(existing):
        warn(f"Dashboard already running  (PID {existing})  http://localhost:{port}")
        sys.exit(0)
    PID_FILE.unlink(missing_ok=True)

    # ── Gateway health check (advisory) ──────────────────────────────────────
    if _health(f"{gateway_url}/health"):
        ok(f"MCP Gateway reachable at {gateway_url}")
    else:
        warn(f"MCP Gateway not reachable at {gateway_url}")
        info("Dashboard will start anyway and retry the gateway connection every 10 s.")
        info(f"To start the gateway: cd ../mcp-gateway && python start.py")

    # ── Install npm packages if missing ──────────────────────────────────────
    node_modules = SCRIPT_DIR / "node_modules"
    if not node_modules.exists():
        print("  Installing dashboard npm packages...")
        subprocess.run(
            ["npm", "install", "--silent"],
            cwd=str(SCRIPT_DIR), check=True,
        )
        ok("npm packages installed")

    # ── Launch ───────────────────────────────────────────────────────────────
    print(f"\n  Starting Daily Briefing Dashboard on port {port} ...")

    env = {**os.environ, "PORT": str(port), "MCP_GATEWAY_URL": gateway_url}
    log_fh = open(LOG_FILE, "a", encoding="utf-8")

    if sys.platform == "win32":
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        proc = subprocess.Popen(
            ["node", str(SERVER_JS)],
            cwd=str(SCRIPT_DIR), env=env,
            stdout=log_fh, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            creationflags=flags,
            close_fds=True,
        )
    else:
        proc = subprocess.Popen(
            ["node", str(SERVER_JS)],
            cwd=str(SCRIPT_DIR), env=env,
            stdout=log_fh, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    log_fh.close()
    PID_FILE.write_text(str(proc.pid))

    # Give Node.js a moment to initialise (it doesn't have a health endpoint)
    time.sleep(1.5)

    if not _is_running(proc.pid):
        err("Dashboard failed to start. Check the log:")
        info(str(LOG_FILE))
        PID_FILE.unlink(missing_ok=True)
        sys.exit(1)

    # Shorten display paths — replace the home directory with ~ so personal
    # system paths are not printed to the terminal.
    home = Path.home()
    def _short(p: Path) -> str:
        try:
            return "~/" + str(p.relative_to(home))
        except ValueError:
            return str(p)

    ok(f"Dashboard running  (PID {proc.pid})")
    info(f"URL  : http://localhost:{port}")
    info(f"Log  : {_short(LOG_FILE)}")
    info(f"Stop : python {_short(SCRIPT_DIR / 'stop.py')}")
    print()


if __name__ == "__main__":
    main()
