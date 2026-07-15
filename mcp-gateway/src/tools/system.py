import platform
import re
import subprocess
import time

import psutil

_last_net      = None
_last_net_ts: float = 0.0
_last_disk     = None
_last_disk_ts: float = 0.0


def _cpu_temp() -> float | None:
    """Return CPU temperature in °C, or None if unavailable."""
    # psutil sensors — works on Linux; macOS support varies by psutil build
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for key in ("coretemp", "k10temp", "cpu_thermal", "CPU", "cpu0", "cpu-thermal"):
                if key in temps and temps[key]:
                    return round(temps[key][0].current, 1)
            # Fallback: first available reading from any sensor
            for readings in temps.values():
                if readings:
                    return round(readings[0].current, 1)
    except (AttributeError, NotImplementedError):
        pass

    # macOS: try osx-cpu-temp (brew install osx-cpu-temp) or powermetrics
    if platform.system() == "Darwin":
        for cmd in (["osx-cpu-temp"], ["sudo", "powermetrics", "--samplers", "smc", "-n", "1", "-i", "1"]):
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
                m = re.search(r"(\d+\.?\d*)\s*°?C", r.stdout)
                if m:
                    return round(float(m.group(1)), 1)
            except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
                continue

    return None


_MACOS_NAMES = {
    "10": "Catalina", "11": "Big Sur",  "12": "Monterey",
    "13": "Ventura",  "14": "Sonoma",   "15": "Sequoia",
    "26": "Tahoe",
}


def _os_info() -> dict:
    system = platform.system()
    machine = platform.machine()

    if system == "Darwin":
        # sw_vers is the reliable source; platform.mac_ver() can return Darwin
        # kernel version on Python 3.13+ instead of the macOS product version.
        try:
            ver = subprocess.run(
                ["sw_vers", "-productVersion"], capture_output=True, text=True, timeout=2
            ).stdout.strip()
        except Exception:
            ver = platform.mac_ver()[0] or platform.release()
        major = ver.split(".")[0] if ver else ""
        codename = _MACOS_NAMES.get(major, "")
        os_label = f"macOS {codename}" if codename else "macOS"
        return {"os": os_label, "version": ver, "arch": machine}

    if system == "Windows":
        release, build, sp, _ = platform.win32_ver()
        display = f"Windows {release}" if release else "Windows"
        if sp and sp not in ("", "SP0"):
            display += f" {sp}"
        return {"os": display, "version": build, "arch": machine}

    # Linux / other
    try:
        import distro  # type: ignore
        name = distro.name(pretty=True) or system
    except ImportError:
        name = f"{system} {platform.release()}"
    return {"os": name, "version": platform.release(), "arch": machine}


def _disk_usage() -> dict:
    """Return root disk usage; on Windows fall back to C:\\."""
    path = "C:\\" if platform.system() == "Windows" else "/"
    d = psutil.disk_usage(path)
    return {
        "percent":  round(d.percent, 1),
        "used_gb":  round(d.used  / 1_073_741_824, 1),
        "total_gb": round(d.total / 1_073_741_824, 1),
    }


def _net_io() -> dict:
    global _last_net, _last_net_ts
    try:
        cur = psutil.net_io_counters()
        now = time.monotonic()
        send_bps: int | None = None
        recv_bps: int | None = None
        if _last_net is not None:
            dt = now - _last_net_ts
            if dt > 0:
                send_bps = max(0, round((cur.bytes_sent - _last_net.bytes_sent) / dt))
                recv_bps = max(0, round((cur.bytes_recv - _last_net.bytes_recv) / dt))
        _last_net    = cur
        _last_net_ts = now
        return {"send_bps": send_bps, "recv_bps": recv_bps}
    except Exception:
        return {}


def _disk_io() -> dict:
    global _last_disk, _last_disk_ts
    try:
        cur = psutil.disk_io_counters()
        if cur is None:
            return {}
        now = time.monotonic()
        read_bps: int | None = None
        write_bps: int | None = None
        if _last_disk is not None:
            dt = now - _last_disk_ts
            if dt > 0:
                read_bps  = max(0, round((cur.read_bytes  - _last_disk.read_bytes)  / dt))
                write_bps = max(0, round((cur.write_bytes - _last_disk.write_bytes) / dt))
        _last_disk    = cur
        _last_disk_ts = now
        return {"read_bps": read_bps, "write_bps": write_bps}
    except Exception:
        return {}


def _battery() -> dict | None:
    try:
        b = psutil.sensors_battery()
        if b is None:
            return None
        secs = b.secsleft
        time_str = None
        if secs > 0:
            h, rem = divmod(int(secs) // 60, 60)
            time_str = f"{h}h {rem:02d}m" if h else f"{rem}m"
        return {
            "percent":       round(b.percent, 1),
            "power_plugged": b.power_plugged,
            "time_left":     time_str,
        }
    except (AttributeError, NotImplementedError):
        return None


def _uptime() -> str | None:
    try:
        secs = int(time.time() - psutil.boot_time())
        days, rem = divmod(secs, 86400)
        hours, rem = divmod(rem, 3600)
        mins = rem // 60
        if days:
            return f"{days}d {hours}h {mins:02d}m"
        if hours:
            return f"{hours}h {mins:02d}m"
        return f"{mins}m"
    except Exception:
        return None


def _load_avg() -> list | None:
    # psutil.getloadavg() works on all platforms since psutil 5.6.2
    # (Windows approximates via CPU rolling average)
    try:
        la = psutil.getloadavg()
        return [round(x, 2) for x in la]
    except (AttributeError, OSError):
        return None


def _cpu_freq() -> dict | None:
    try:
        freq = psutil.cpu_freq()
        if freq is None:
            return None
        return {
            "current_ghz": round(freq.current / 1000, 2),
            "max_ghz":     round(freq.max / 1000, 2) if freq.max else None,
        }
    except Exception:
        return None


def _top_processes(n: int = 5) -> list:
    try:
        procs = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info", "status"]):
            try:
                info = p.info
                if info.get("status") in ("zombie", "dead"):
                    continue
                mem_info = info.get("memory_info")
                mem_mb = round(mem_info.rss / 1_048_576, 1) if mem_info else 0
                cpu = info.get("cpu_percent") or 0
                procs.append({
                    "name":   info.get("name") or "unknown",
                    "cpu":    round(cpu, 1),
                    "mem_mb": mem_mb,
                    "pid":    info.get("pid"),
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        procs.sort(key=lambda p: (p["cpu"], p["mem_mb"]), reverse=True)
        return procs[:n]
    except Exception:
        return []


def fetch_system_stats() -> dict:
    cpu_pct = psutil.cpu_percent(interval=0.5)
    ram     = psutil.virtual_memory()
    swap    = psutil.swap_memory()

    swap_data = None
    if swap.total > 0:
        swap_data = {
            "percent":  round(swap.percent, 1),
            "used_gb":  round(swap.used  / 1_073_741_824, 1),
            "total_gb": round(swap.total / 1_073_741_824, 1),
        }

    return {
        "cpu": {
            "percent":  round(cpu_pct, 1),
            "cores":    psutil.cpu_count(logical=True),
            "physical": psutil.cpu_count(logical=False),
        },
        "ram": {
            "percent":  round(ram.percent, 1),
            "used_gb":  round(ram.used  / 1_073_741_824, 1),
            "total_gb": round(ram.total / 1_073_741_824, 1),
        },
        "disk":          _disk_usage(),
        "temperature":   _cpu_temp(),
        "network":       _net_io(),
        "disk_io":       _disk_io(),
        "battery":       _battery(),
        "uptime":        _uptime(),
        "load_avg":      _load_avg(),
        "cpu_freq":      _cpu_freq(),
        "swap":          swap_data,
        "top_processes": _top_processes(),
        "os":            _os_info(),
    }
