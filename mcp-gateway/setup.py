#!/usr/bin/env python3
"""
MCP Gateway — one-time setup.
Run this once after cloning.  Works on Windows, macOS, and Linux.

What it does:
  1. Verifies Python 3.11+ is available
  2. Creates .env from .env.example if not present
  3. Creates the logs/ directory
  4. Creates a virtual environment (.venv)
  5. Installs all Python dependencies

Usage:
    python setup.py
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR  = Path(__file__).resolve().parent
MIN_PYTHON  = (3, 11)


# ── Terminal colour helpers ───────────────────────────────────────────────────

def _enable_ansi() -> None:
    """Enable ANSI escape codes on Windows 10+ (cmd / PowerShell)."""
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
def head(msg: str) -> None: print(f"\n{_c('1', msg)}")


# ── Venv helpers ──────────────────────────────────────────────────────────────

def _venv_exe(venv: Path, name: str) -> Path:
    """Return the platform-correct path to a venv executable."""
    if sys.platform == "win32":
        return venv / "Scripts" / (name + ".exe")
    return venv / "bin" / name


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    head("MCP Gateway Setup")
    print("=" * 52)

    # ── Python version check ─────────────────────────────────────────────────
    head("Checking Python version...")
    v = sys.version_info[:2]
    if v < MIN_PYTHON:
        err(
            f"Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+ is required. "
            f"Found {v[0]}.{v[1]}."
        )
        info("Download the latest Python from https://www.python.org/downloads/")
        info("On Windows, tick 'Add Python to PATH' during installation.")
        sys.exit(1)
    ok(f"Python {sys.version.split()[0]}")

    # ── .env ─────────────────────────────────────────────────────────────────
    head("Checking .env file...")
    env_path    = SCRIPT_DIR / ".env"
    env_example = SCRIPT_DIR / ".env.example"
    if not env_path.exists():
        if not env_example.exists():
            err(".env.example not found — cannot create .env")
            sys.exit(1)
        shutil.copy(env_example, env_path)
        if sys.platform != "win32":
            os.chmod(env_path, 0o600)
        ok(".env created from .env.example")
        warn("Edit mcp-gateway/.env and add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before starting.")
    else:
        ok(".env already exists")

    # ── logs directory ───────────────────────────────────────────────────────
    logs_dir = SCRIPT_DIR / "logs"
    logs_dir.mkdir(exist_ok=True)
    if sys.platform != "win32":
        os.chmod(logs_dir, 0o700)
    ok("logs/ directory ready")

    # ── Virtual environment ──────────────────────────────────────────────────
    head("Setting up virtual environment (.venv)...")
    venv_dir = SCRIPT_DIR / ".venv"
    if not venv_dir.exists():
        info("Creating .venv ...")
        subprocess.run(
            [sys.executable, "-m", "venv", str(venv_dir)],
            check=True,
        )
    ok(".venv ready")

    # ── Install dependencies ─────────────────────────────────────────────────
    head("Installing Python dependencies...")
    pip = _venv_exe(venv_dir, "pip")
    reqs = SCRIPT_DIR / "requirements.txt"
    subprocess.run(
        [str(pip), "install", "--quiet", "--upgrade", "pip"],
        check=True,
    )
    subprocess.run(
        [str(pip), "install", "--quiet", "-r", str(reqs)],
        check=True,
    )
    ok("All dependencies installed")

    # ── Print next steps ─────────────────────────────────────────────────────
    venv_py = (
        r".venv\Scripts\python.exe"
        if sys.platform == "win32"
        else ".venv/bin/python"
    )
    print(f"\n{'=' * 52}")
    ok("Setup complete!")
    head("Next steps:")
    info("1. Edit  mcp-gateway/.env  — add your Google credentials:")
    info("       GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com")
    info("       GOOGLE_CLIENT_SECRET=<your-client-secret>")
    info("")
    info("2. Authorise Google services (opens browser):")
    info(f"       cd mcp-gateway")
    info(f"       {venv_py} scripts/auth_all.py")
    info("")
    info("3. Start the gateway:")
    info("       python start.py")
    info("")
    info("4. Start the dashboard (separate terminal):")
    info("       cd ../daily-briefing-dashboard")
    info("       python start.py")
    info("")
    info("   — or run the full stack from the repo root:")
    info("       python scripts/start_dashboard.py start")
    print()


if __name__ == "__main__":
    main()
