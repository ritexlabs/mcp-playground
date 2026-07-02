#!/usr/bin/env python3
"""
Start the MCP Gateway as a background process.
Works on Windows, macOS, and Linux.

Usage:
    python start.py [--host HOST] [--port PORT]
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

SCRIPT_DIR = Path(__file__).resolve().parent
PID_FILE   = SCRIPT_DIR / ".gateway.pid"
LOG_FILE   = SCRIPT_DIR / "logs" / "gateway.log"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


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


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Start MCP Gateway")
    parser.add_argument(
        "--host", default=os.environ.get("MCP_HOST", DEFAULT_HOST)
    )
    parser.add_argument(
        "--port", type=int,
        default=int(os.environ.get("MCP_PORT", DEFAULT_PORT)),
    )
    args = parser.parse_args()
    host, port = args.host, args.port
    health_url = f"http://{host}:{port}/health"

    # ── Pre-flight checks ────────────────────────────────────────────────────
    venv_dir = SCRIPT_DIR / ".venv"
    if not venv_dir.exists():
        err(".venv not found — run  python setup.py  first.")
        sys.exit(1)

    env_file = SCRIPT_DIR / ".env"
    if not env_file.exists():
        err(".env not found — copy .env.example to .env and fill in your credentials.")
        sys.exit(1)

    # ── Already running? ─────────────────────────────────────────────────────
    existing = _read_pid()
    if existing and _is_running(existing):
        warn(f"Gateway already running (PID {existing}) at http://{host}:{port}")
        sys.exit(0)
    PID_FILE.unlink(missing_ok=True)

    # ── Build launch command ──────────────────────────────────────────────────
    # Use  python -m uvicorn  via the venv's interpreter so it works on all
    # platforms without relying on the uvicorn shebang or file extension.
    venv_py = (
        venv_dir / "Scripts" / "python.exe"
        if sys.platform == "win32"
        else venv_dir / "bin" / "python"
    )
    cmd = [
        str(venv_py), "-m", "uvicorn", "src.main:app",
        "--host", host,
        "--port", str(port),
        "--log-level", "info",
    ]

    LOG_FILE.parent.mkdir(exist_ok=True)
    log_fh = open(LOG_FILE, "a", encoding="utf-8")

    print(f"\n  Starting MCP Gateway on http://{host}:{port} ...")

    if sys.platform == "win32":
        # DETACHED_PROCESS keeps the process alive after the terminal closes.
        # CREATE_NEW_PROCESS_GROUP lets Windows send Ctrl+Break signals cleanly.
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        proc = subprocess.Popen(
            cmd, cwd=str(SCRIPT_DIR),
            stdout=log_fh, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            creationflags=flags,
            close_fds=True,
        )
    else:
        proc = subprocess.Popen(
            cmd, cwd=str(SCRIPT_DIR),
            stdout=log_fh, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    log_fh.close()
    PID_FILE.write_text(str(proc.pid))

    # ── Wait for healthy response ─────────────────────────────────────────────
    for _ in range(20):           # up to 10 s (20 × 0.5 s)
        time.sleep(0.5)
        if _health(health_url):
            ok(f"Gateway is up  (PID {proc.pid})")
            info(f"Health : {health_url}")
            info(f"SSE    : http://{host}:{port}/sse")
            info(f"Logs   : {LOG_FILE}")
            print()
            sys.exit(0)

    err(f"Gateway did not respond within 10 s. Check logs:")
    info(str(LOG_FILE))
    PID_FILE.unlink(missing_ok=True)
    sys.exit(1)


if __name__ == "__main__":
    main()
