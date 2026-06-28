import re
from pathlib import Path


class MCPError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class AuthenticationError(MCPError):
    def __init__(self, message: str):
        super().__init__(message, "AUTH_ERROR", 401)


class ConfigurationError(MCPError):
    def __init__(self, message: str):
        super().__init__(message, "CONFIG_ERROR", 500)


class ValidationError(MCPError):
    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR", 400)


class RateLimitError(MCPError):
    def __init__(self, message: str):
        super().__init__(message, "RATE_LIMIT_ERROR", 429)


class ServiceError(MCPError):
    def __init__(self, service: str, message: str):
        super().__init__(f"{service} service error: {message}", "SERVICE_ERROR", 500)


def sanitize_error(error: Exception) -> str:
    msg = str(error)
    home = str(Path.home())
    msg = msg.replace(home, "[HOME]")
    msg = re.sub(r"[A-Za-z0-9_\-]{30,}", "[REDACTED]", msg)
    return msg
