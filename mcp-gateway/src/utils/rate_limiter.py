import time
from .errors import RateLimitError


class RateLimiter:
    def __init__(self, requests_per_minute: int = 60, enabled: bool = True):
        self._rpm = requests_per_minute
        self._enabled = enabled
        self._buckets: dict[str, dict[str, float]] = {}

    def check_limit(self, tool_name: str) -> None:
        if not self._enabled:
            return

        now = time.monotonic()
        key = f"tool:{tool_name}"
        bucket = self._buckets.get(key, {"tokens": float(self._rpm), "last_refill": now})

        elapsed = now - bucket["last_refill"]
        bucket["tokens"] = min(self._rpm, bucket["tokens"] + elapsed / 60.0 * self._rpm)
        bucket["last_refill"] = now

        if bucket["tokens"] < 1:
            self._buckets[key] = bucket
            raise RateLimitError(
                f"Rate limit exceeded for {tool_name}. Max {self._rpm} requests/min."
            )

        bucket["tokens"] -= 1
        self._buckets[key] = bucket


def _make_rate_limiter() -> RateLimiter:
    from ..config.settings import settings
    return RateLimiter(
        requests_per_minute=settings.RATE_LIMIT_REQUESTS_PER_MINUTE,
        enabled=settings.RATE_LIMIT_ENABLED,
    )


rate_limiter: RateLimiter = _make_rate_limiter()
