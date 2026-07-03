import os
import re
import signal
import subprocess
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config.secrets import update_env_setting
from ..config.settings import settings

router = APIRouter(prefix="/api/tunnel", tags=["tunnel"])

_BASE_DIR = Path(__file__).parent.parent.parent
TUNNEL_PID_FILE = _BASE_DIR / ".cf-tunnel.pid"

_tunnel_proc: subprocess.Popen | None = None
_quick_tunnel_url: str | None = None
_lock = threading.Lock()


def _pid_from_file() -> int | None:
    try:
        return int(TUNNEL_PID_FILE.read_text().strip())
    except Exception:
        return None


def _is_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError, TypeError):
        return False


def is_running() -> bool:
    with _lock:
        if _tunnel_proc and _is_alive(_tunnel_proc.pid):
            return True
    return _is_alive(_pid_from_file())


def _kill():
    global _tunnel_proc, _quick_tunnel_url
    with _lock:
        if _tunnel_proc:
            try:
                _tunnel_proc.terminate()
            except Exception:
                pass
            _tunnel_proc = None
    pid = _pid_from_file()
    if pid:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
    try:
        TUNNEL_PID_FILE.unlink()
    except Exception:
        pass
    _quick_tunnel_url = None


# Clean up stale PID on import
try:
    _stale = _pid_from_file()
    if _stale and not _is_alive(_stale):
        TUNNEL_PID_FILE.unlink(missing_ok=True)
except Exception:
    pass


_CFG_PATH = _BASE_DIR / ".cloudflared" / "tunnel-whatsapp.yml"


def _detect_mode() -> str:
    """Return 'named' | 'quick' | 'hostname' depending on current .env settings."""
    if (settings.CLOUDFLARE_TUNNEL_NAME or "").strip():
        return "named"
    if (settings.WHATSAPP_WEBHOOK_DOMAIN or "").strip():
        return "hostname"
    return "quick"


@router.get("/status")
async def tunnel_status():
    running = is_running()
    raw = (settings.WHATSAPP_WEBHOOK_DOMAIN or _quick_tunnel_url or "")
    raw = raw.replace("https://", "").replace("http://", "").rstrip("/")
    return {
        "running":      running,
        "mode":         _detect_mode(),
        "domain":       raw or None,
        "quickUrl":     _quick_tunnel_url or None,
        "configExists": _CFG_PATH.exists(),
        "webhookUrl":   f"https://{raw}/webhook/whatsapp" if raw else None,
    }


@router.get("/config")
async def tunnel_config_get():
    if _CFG_PATH.exists():
        return {"exists": True, "content": _CFG_PATH.read_text(), "path": str(_CFG_PATH.relative_to(_BASE_DIR))}
    return {"exists": False, "content": "", "path": str(_CFG_PATH.relative_to(_BASE_DIR))}


@router.post("/config")
async def tunnel_config_save(body: dict):
    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(400, "content is required")
    _CFG_PATH.parent.mkdir(exist_ok=True)
    _CFG_PATH.write_text(content + "\n")
    return {"ok": True}


@router.post("/start")
async def tunnel_start():
    global _tunnel_proc, _quick_tunnel_url

    if is_running():
        return {"ok": True, "alreadyRunning": True}

    domain = (settings.WHATSAPP_WEBHOOK_DOMAIN or "").replace("https://", "").replace("http://", "").rstrip("/")
    port   = settings.MCP_PORT

    tunnel_name = (settings.CLOUDFLARE_TUNNEL_NAME or "").strip()
    if tunnel_name:
        _CFG_PATH.parent.mkdir(exist_ok=True)
        # Only auto-generate the config when it doesn't already exist so that
        # manual edits saved via POST /api/tunnel/config are preserved.
        if not _CFG_PATH.exists():
            cred_file = Path.home() / ".cloudflared" / f"{tunnel_name}.json"
            cfg_lines = [f"tunnel: {tunnel_name}"]
            if cred_file.exists():
                cfg_lines.append(f"credentials-file: {cred_file}")
            cfg_lines += ["", "ingress:"]
            if domain:
                cfg_lines.append(f"  - hostname: {domain}")
                cfg_lines.append(f"    service: http://localhost:{port}")
            cfg_lines.append("  - service: http_status:404")
            _CFG_PATH.write_text("\n".join(cfg_lines) + "\n")
        args = ["cloudflared", "tunnel", "--config", str(_CFG_PATH), "run"]
    elif domain:
        args = ["cloudflared", "tunnel", "--hostname", domain, "--url", f"http://localhost:{port}"]
    else:
        args = ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"]

    try:
        proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="cloudflared not found. Install: brew install cloudflare/cloudflare/cloudflared",
        )

    with _lock:
        _tunnel_proc = proc

    try:
        TUNNEL_PID_FILE.write_text(str(proc.pid))
    except Exception:
        pass

    def _capture(stream):
        global _quick_tunnel_url
        try:
            for line in stream:
                m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
                if m and not _quick_tunnel_url:
                    url = m.group(0).replace("https://", "")
                    _quick_tunnel_url = url
                    if not domain:
                        settings.WHATSAPP_WEBHOOK_DOMAIN = url
                        update_env_setting("WHATSAPP_WEBHOOK_DOMAIN", url)
        except Exception:
            pass

    threading.Thread(target=_capture, args=(proc.stdout,), daemon=True).start()
    threading.Thread(target=_capture, args=(proc.stderr,), daemon=True).start()

    def _on_exit():
        global _tunnel_proc, _quick_tunnel_url
        proc.wait()
        with _lock:
            if _tunnel_proc and _tunnel_proc.pid == proc.pid:
                _tunnel_proc = None
        _quick_tunnel_url = None
        TUNNEL_PID_FILE.unlink(missing_ok=True)

    threading.Thread(target=_on_exit, daemon=True).start()

    return {"ok": True, "pid": proc.pid, "domain": domain or None}


@router.post("/stop")
async def tunnel_stop():
    _kill()
    return {"ok": True}
