#!/usr/bin/env python3
"""
MCP Gateway management — setup, start, stop, status, restart.

Usage (from anywhere in the repo):
    python scripts/mcp_gateway.py setup
    python scripts/mcp_gateway.py start
    python scripts/mcp_gateway.py stop
    python scripts/mcp_gateway.py status
    python scripts/mcp_gateway.py restart
"""

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPTS_DIR  = Path(__file__).resolve().parent
REPO_DIR     = SCRIPTS_DIR.parent
GATEWAY_DIR  = REPO_DIR / "mcp-gateway"
PID_FILE     = GATEWAY_DIR / ".gateway.pid"
LOG_FILE     = GATEWAY_DIR / "logs" / "gateway.log"
ENV_FILE     = GATEWAY_DIR / ".env"
ENV_EXAMPLE  = GATEWAY_DIR / ".env.example"
VENV_DIR     = GATEWAY_DIR / ".venv"
REQUIREMENTS = GATEWAY_DIR / "requirements.txt"

DEFAULT_HOST = os.environ.get("MCP_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.environ.get("MCP_PORT", 8000))

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


def _health(host: str, port: int) -> bool:
    try:
        with urlopen(f"http://{host}:{port}/health", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _venv_exe(name: str) -> Path:
    if sys.platform == "win32":
        return VENV_DIR / "Scripts" / f"{name}.exe"
    return VENV_DIR / "bin" / name


def _read_env(key: str) -> str:
    try:
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() == key:
                return v.strip().strip('"').strip("'")
    except Exception:
        pass
    return ""


def _mask(token: str) -> str:
    if not token:
        return "(not set — will be auto-generated on first start)"
    if len(token) <= 12:
        return "●" * len(token)
    return token[:8] + "…" + token[-4:]


def _gateway_url(host: str, port: int) -> str:
    return f"http://{host}:{port}"

# ── Commands ───────────────────────────────────────────────────────────────────

def do_setup() -> None:
    head("MCP Gateway — Setup")

    # Python version
    v = sys.version_info[:2]
    if v < (3, 11):
        err(f"Python 3.11+ required (found {v[0]}.{v[1]})")
        sys.exit(1)
    ok(f"Python {sys.version.split()[0]}")

    # .env
    if not ENV_FILE.exists():
        if not ENV_EXAMPLE.exists():
            err(".env.example not found")
            sys.exit(1)
        shutil.copy(ENV_EXAMPLE, ENV_FILE)
        if sys.platform != "win32":
            os.chmod(ENV_FILE, 0o600)
        ok(".env created from .env.example")
        warn("Edit mcp-gateway/.env — add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET before starting")
    else:
        ok(".env exists")

    # logs dir
    (GATEWAY_DIR / "logs").mkdir(exist_ok=True)
    ok("logs/ directory ready")

    # venv
    if not VENV_DIR.exists():
        info("Creating .venv ...")
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
    ok(".venv ready")

    # deps
    info("Installing Python dependencies (may take a minute) ...")
    subprocess.run([str(_venv_exe("pip")), "install", "--quiet", "--upgrade", "pip"], check=True)
    subprocess.run([str(_venv_exe("pip")), "install", "--quiet", "-r", str(REQUIREMENTS)], check=True)
    ok("Dependencies installed")

    venv_py = r".venv\Scripts\python.exe" if sys.platform == "win32" else ".venv/bin/python"
    print()
    ok("Setup complete!")
    print()
    info("Next steps:")
    info(f"  1.  Edit  mcp-gateway/.env  — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET")
    info(f"  2.  Authorise Google (opens browser):")
    info(f"        cd mcp-gateway && {venv_py} scripts/auth_all.py")
    info(f"  3.  Start the gateway:")
    info(f"        python scripts/mcp_gateway.py start")
    print()


def do_start() -> None:
    head("MCP Gateway — Start")

    host = _read_env("MCP_HOST") or DEFAULT_HOST
    port_s = _read_env("MCP_PORT")
    port = int(port_s) if port_s.isdigit() else DEFAULT_PORT

    if not VENV_DIR.exists():
        err(".venv not found — run:  python scripts/mcp_gateway.py setup")
        sys.exit(1)
    if not ENV_FILE.exists():
        err(".env not found — run:  python scripts/mcp_gateway.py setup")
        sys.exit(1)

    existing = _read_pid()
    if existing and _is_running(existing):
        warn(f"Gateway already running  (PID {existing})")
        _print_info(host, port, existing)
        sys.exit(0)
    PID_FILE.unlink(missing_ok=True)

    cmd = [
        str(_venv_exe("python")), "-m", "uvicorn", "src.main:app",
        "--host", host, "--port", str(port), "--log-level", "info",
    ]
    LOG_FILE.parent.mkdir(exist_ok=True)
    log_fh = open(LOG_FILE, "a", encoding="utf-8")

    info(f"Launching on http://{host}:{port} ...")
    kw = {}
    if sys.platform == "win32":
        kw["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        kw["close_fds"] = True
    else:
        kw["start_new_session"] = True

    proc = subprocess.Popen(cmd, cwd=str(GATEWAY_DIR),
                            stdout=log_fh, stderr=subprocess.STDOUT,
                            stdin=subprocess.DEVNULL, **kw)
    log_fh.close()
    PID_FILE.write_text(str(proc.pid))

    for _ in range(24):           # up to 12 s
        time.sleep(0.5)
        if _health(host, port):
            token = _read_env("GATEWAY_API_TOKEN")
            ok(f"Gateway is up  (PID {proc.pid})")
            print()
            _print_info(host, port, proc.pid, show_full_token=True)
            return

    err("Gateway did not respond within 12 s — check logs:")
    info(str(LOG_FILE))
    PID_FILE.unlink(missing_ok=True)
    sys.exit(1)


def do_stop() -> None:
    head("MCP Gateway — Stop")
    port_s = _read_env("MCP_PORT")
    port = int(port_s) if port_s.isdigit() else DEFAULT_PORT

    pid = _read_pid()
    if pid:
        if _is_running(pid):
            _terminate(pid)
            ok(f"Gateway stopped  (PID {pid})")
        else:
            warn("PID file was stale — gateway was already stopped")
        PID_FILE.unlink(missing_ok=True)
        return

    pid = _pid_on_port(port)
    if pid:
        _terminate(pid)
        ok(f"Gateway process on port {port} stopped  (PID {pid})")
    else:
        warn("Gateway is not running")


def do_status() -> None:
    host = _read_env("MCP_HOST") or DEFAULT_HOST
    port_s = _read_env("MCP_PORT")
    port = int(port_s) if port_s.isdigit() else DEFAULT_PORT

    pid = _read_pid()
    running = pid is not None and _is_running(pid)
    alive = running and _health(host, port)

    print(f"\n{_c('1', 'MCP Gateway — Status')}")
    print("─" * 40)
    if running:
        state = _c("32", "● running") + (f"  ({_c('32', 'online')})" if alive else f"  ({_c('33', 'starting…')})")
        print(f"  Status  {state}  PID {pid}")
    else:
        print(f"  Status  {_c('31', '○ stopped')}")

    if running:
        _print_info(host, port, pid)
    print()


def _print_info(host: str, port: int, pid: int | None = None, show_full_token: bool = False) -> None:
    gw_url   = _gateway_url(host, port)
    token    = _read_env("GATEWAY_API_TOKEN")
    tok_disp = token if (show_full_token and token) else _mask(token)

    lines = [
        f"MCP  (HTTP)  :  {gw_url}/mcp          ← Claude Desktop / Cursor / Gemini",
        f"MCP  (SSE)   :  {gw_url}/sse          ← legacy SSE clients",
        f"Dashboard    :  {gw_url}/dashboard    ← configure integrations",
        f"Health       :  {gw_url}/health",
        f"API Token    :  {tok_disp}",
    ]
    if pid:
        lines.append(f"PID          :  {pid}")
    lines.append(f"Logs         :  {LOG_FILE}")
    print()
    box(lines)
    print()


# ── Entry point ────────────────────────────────────────────────────────────────

COMMANDS = {
    "setup":   do_setup,
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
        print(f"\nUsage: python {prog} {{setup|start|stop|status|restart}}\n")
        print("  setup    Install deps + create .env from .env.example")
        print("  start    Start gateway in background, show endpoint + token")
        print("  stop     Stop the gateway")
        print("  status   Show running state, endpoint, and API token")
        print("  restart  Stop then start")
        sys.exit(1)


if __name__ == "__main__":
    main()
