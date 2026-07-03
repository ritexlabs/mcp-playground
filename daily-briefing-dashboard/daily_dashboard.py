#!/usr/bin/env python3
"""
Daily Briefing Dashboard management — start, stop, status, restart.

Usage (from anywhere in the repo):
    python scripts/daily_dashboard.py start
    python scripts/daily_dashboard.py stop
    python scripts/daily_dashboard.py status
    python scripts/daily_dashboard.py restart
"""

import os
import signal
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.request import urlopen

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPTS_DIR   = Path(__file__).resolve().parent
REPO_DIR      = SCRIPTS_DIR.parent
DASHBOARD_DIR = REPO_DIR / "daily-briefing-dashboard"
SERVER_JS     = DASHBOARD_DIR / "server.js"
PID_FILE      = DASHBOARD_DIR / ".server.pid"
LOG_FILE      = DASHBOARD_DIR / ".server.log"
ENV_FILE      = DASHBOARD_DIR / ".env"
GATEWAY_DIR   = REPO_DIR / "mcp-gateway"

DEFAULT_PORT        = int(os.environ.get("PORT", 8080))
DEFAULT_GATEWAY_URL = os.environ.get("MCP_GATEWAY_URL", "http://127.0.0.1:8000")

# ── Colour helpers ─────────────────────────────────────────────────────────────

def _ansi():
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(ctypes.windll.kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass

_ansi()

def _c(code, t): return f"\033[{code}m{t}\033[0m"

def ok(m):   print(_c("32",   f"  ✓  {m}"))
def warn(m): print(_c("33",   f"  ⚠  {m}"))
def err(m):  print(_c("31",   f"  ✗  {m}"), file=sys.stderr)
def info(m): print(          f"     {m}")
def head(m): print(f"\n{_c('1;36', m)}\n{'─' * 56}")
def box(lines):
    w = max(len(l) for l in lines) + 4
    print(_c("1;36", "┌" + "─" * w + "┐"))
    for l in lines:
        print(_c("1;36", "│") + f"  {l:<{w-2}}" + _c("1;36", "│"))
    print(_c("1;36", "└" + "─" * w + "┘"))

# ── Utilities ──────────────────────────────────────────────────────────────────

def _is_running(pid: int) -> bool:
    if not pid:
        return False
    try:
        if sys.platform == "win32":
            r = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV"],
                               capture_output=True, text=True)
            return str(pid) in r.stdout
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def _read_pid() -> int | None:
    try:
        return int(PID_FILE.read_text().strip())
    except Exception:
        return None


def _terminate(pid: int) -> None:
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, check=False)
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    for _ in range(10):
        time.sleep(0.5)
        if not _is_running(pid):
            return
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def _pid_on_port(port: int) -> int | None:
    try:
        if sys.platform == "win32":
            r = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
            for line in r.stdout.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.split()
                    if parts and parts[-1].isdigit():
                        return int(parts[-1])
        else:
            r = subprocess.run(["lsof", "-ti", f"tcp:{port}"], capture_output=True, text=True)
            for part in r.stdout.strip().splitlines():
                if part.strip().isdigit():
                    return int(part.strip())
    except Exception:
        pass
    return None


def _gateway_reachable(gateway_url: str) -> bool:
    try:
        with urlopen(f"{gateway_url}/health", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _read_env(key: str, env_file: Path = ENV_FILE) -> str:
    try:
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() == key:
                return v.strip().strip('"').strip("'")
    except Exception:
        pass
    return ""


def _node_available() -> bool:
    try:
        return subprocess.run(["node", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def _open_browser(url: str) -> None:
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", url], start_new_session=True)
        elif sys.platform == "win32":
            os.startfile(url)  # type: ignore[attr-defined]
        else:
            webbrowser.open(url)
    except Exception:
        pass


def _print_info(port: int, pid: int | None = None) -> None:
    dashboard_url = f"http://localhost:{port}"
    gateway_url   = _read_env("MCP_GATEWAY_URL") or DEFAULT_GATEWAY_URL
    lines = [
        f"Dashboard    :  {dashboard_url}",
        f"Gateway      :  {gateway_url}",
        f"Gateway Dash :  {gateway_url}/dashboard",
    ]
    if pid:
        lines.append(f"PID          :  {pid}")
    lines.append(f"Logs         :  {LOG_FILE}")
    print()
    box(lines)
    print()

# ── Commands ───────────────────────────────────────────────────────────────────

def do_start() -> None:
    head("Daily Briefing Dashboard — Start")

    port = int(_read_env("PORT") or DEFAULT_PORT)
    gateway_url = _read_env("MCP_GATEWAY_URL") or DEFAULT_GATEWAY_URL

    if not _node_available():
        err("node not found in PATH")
        info("Install Node.js 18+ from https://nodejs.org/ and reopen your terminal.")
        sys.exit(1)

    if not SERVER_JS.exists():
        err(f"server.js not found at {SERVER_JS}")
        sys.exit(1)

    existing = _read_pid()
    if existing and _is_running(existing):
        warn(f"Dashboard already running  (PID {existing})")
        _print_info(port, existing)
        sys.exit(0)
    PID_FILE.unlink(missing_ok=True)

    # Gateway advisory check
    if _gateway_reachable(gateway_url):
        ok(f"MCP Gateway reachable at {gateway_url}")
    else:
        warn(f"MCP Gateway not reachable at {gateway_url}")
        info("Dashboard will start anyway — it retries the gateway connection automatically.")
        info("To start the gateway:  python scripts/mcp_gateway.py start")

    # Install npm packages if missing
    if not (DASHBOARD_DIR / "node_modules").exists():
        info("Installing npm packages ...")
        subprocess.run(["npm", "install", "--silent"], cwd=str(DASHBOARD_DIR), check=True)
        ok("npm packages installed")

    info(f"Launching on http://localhost:{port} ...")
    env = {**os.environ, "PORT": str(port), "MCP_GATEWAY_URL": gateway_url}
    log_fh = open(LOG_FILE, "a", encoding="utf-8")

    kw: dict = {}
    if sys.platform == "win32":
        kw["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        kw["close_fds"] = True
    else:
        kw["start_new_session"] = True

    proc = subprocess.Popen(
        ["node", str(SERVER_JS)],
        cwd=str(DASHBOARD_DIR), env=env,
        stdout=log_fh, stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL, **kw,
    )
    log_fh.close()
    PID_FILE.write_text(str(proc.pid))

    time.sleep(1.5)
    if not _is_running(proc.pid):
        err("Dashboard failed to start — check the log:")
        info(str(LOG_FILE))
        PID_FILE.unlink(missing_ok=True)
        sys.exit(1)

    ok(f"Dashboard running  (PID {proc.pid})")
    _print_info(port, proc.pid)

    # Auto-open browser
    dash_url = f"http://localhost:{port}"
    info(f"Opening {dash_url} in your browser ...")
    _open_browser(dash_url)


def do_stop() -> None:
    head("Daily Briefing Dashboard — Stop")
    port = int(_read_env("PORT") or DEFAULT_PORT)

    pid = _read_pid()
    if pid:
        if _is_running(pid):
            _terminate(pid)
            ok(f"Dashboard stopped  (PID {pid})")
        else:
            warn("PID file was stale — dashboard was already stopped")
        PID_FILE.unlink(missing_ok=True)
        return

    pid = _pid_on_port(port)
    if pid:
        _terminate(pid)
        ok(f"Dashboard process on port {port} stopped  (PID {pid})")
    else:
        warn("Dashboard is not running")


def do_status() -> None:
    port = int(_read_env("PORT") or DEFAULT_PORT)
    pid  = _read_pid()
    running = pid is not None and _is_running(pid)

    print(f"\n{_c('1', 'Daily Briefing Dashboard — Status')}")
    print("─" * 44)
    if running:
        print(f"  Status  {_c('32', '● running')}  PID {pid}")
        _print_info(port, pid)
    else:
        print(f"  Status  {_c('31', '○ stopped')}")
    print()

# ── Entry point ────────────────────────────────────────────────────────────────

COMMANDS = {
    "start":   do_start,
    "stop":    do_stop,
    "status":  do_status,
    "restart": lambda: (do_stop(), do_start()),
}

def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd in COMMANDS:
        COMMANDS[cmd]()
    else:
        prog = Path(sys.argv[0]).name
        print(f"\nUsage: python {prog} {{start|stop|status|restart}}\n")
        print("  start    Start dashboard in background and open browser")
        print("  stop     Stop the dashboard")
        print("  status   Show running state and dashboard URL")
        print("  restart  Stop then start")
        sys.exit(1)


if __name__ == "__main__":
    main()
