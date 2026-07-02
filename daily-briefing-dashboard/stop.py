#!/usr/bin/env python3
"""
Stop the Daily Briefing Dashboard.
Works on Windows, macOS, and Linux.

Usage:
    python stop.py [--port PORT]
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PID_FILE   = SCRIPT_DIR / ".server.pid"


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


def _terminate(pid: int) -> None:
    """Graceful stop; escalates to force-kill if needed."""
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/F"],
            capture_output=True, check=False,
        )
    else:
        import signal
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        for _ in range(10):          # wait up to 5 s
            time.sleep(0.5)
            if not _is_running(pid):
                return
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _pid_on_port(port: int) -> int | None:
    """Find the PID of a process listening on the given TCP port."""
    try:
        if sys.platform == "win32":
            r = subprocess.run(
                ["netstat", "-ano"], capture_output=True, text=True
            )
            for line in r.stdout.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.split()
                    if parts and parts[-1].isdigit():
                        return int(parts[-1])
        else:
            r = subprocess.run(
                ["lsof", "-ti", f"tcp:{port}"], capture_output=True, text=True
            )
            for part in r.stdout.strip().splitlines():
                part = part.strip()
                if part.isdigit():
                    return int(part)
    except Exception:
        pass
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Stop Daily Briefing Dashboard")
    parser.add_argument(
        "--port", type=int,
        default=int(os.environ.get("PORT", 8080)),
    )
    args = parser.parse_args()

    # ── Try PID file first ────────────────────────────────────────────────────
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            if _is_running(pid):
                _terminate(pid)
                PID_FILE.unlink(missing_ok=True)
                ok(f"Dashboard stopped  (PID {pid})")
            else:
                PID_FILE.unlink(missing_ok=True)
                warn("PID file was stale — dashboard was already stopped")
        except (ValueError, OSError):
            PID_FILE.unlink(missing_ok=True)
        return

    # ── Fallback: find by port ────────────────────────────────────────────────
    pid = _pid_on_port(args.port)
    if pid:
        _terminate(pid)
        ok(f"Dashboard process on port {args.port} stopped  (PID {pid})")
    else:
        warn("Dashboard is not running")


if __name__ == "__main__":
    main()
