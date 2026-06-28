import json
import logging
from datetime import datetime, date
from pathlib import Path

_logs_dir = Path.home() / ".local" / "mcp-gateway" / "logs"
_logs_dir.mkdir(parents=True, exist_ok=True, mode=0o700)


class _JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data: dict = {
            "level": record.levelname.lower(),
            "time": datetime.utcnow().isoformat() + "Z",
            "message": record.getMessage(),
        }
        # Attach any extra fields passed via the `extra` kwarg
        skip = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__)
        for k, v in record.__dict__.items():
            if k not in skip and not k.startswith("_"):
                data[k] = v
        return json.dumps(data)


def _make_logger() -> logging.Logger:
    log = logging.getLogger("mcp-gateway")
    log.setLevel(logging.DEBUG)
    log.propagate = False

    fh = logging.FileHandler(
        _logs_dir / f"audit-{date.today().isoformat()}.log", mode="a"
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(_JSONFormatter())
    log.addHandler(fh)

    return log


logger = _make_logger()


def _write(level: int, event: str, **fields: object) -> None:
    extra = {"event": event, **fields}
    logger.log(level, event, extra=extra)


def log_tool_access(tool: str, arguments: dict) -> None:
    _write(logging.INFO, "tool_access", tool=tool, arguments=arguments)


def log_auth_event(service: str, action: str, success: bool, **details: object) -> None:
    _write(logging.INFO, "auth_event", service=service, action=action,
           success=success, **details)


def log_system_event(action: str, **fields: object) -> None:
    _write(logging.INFO, "system_event", action=action, **fields)
