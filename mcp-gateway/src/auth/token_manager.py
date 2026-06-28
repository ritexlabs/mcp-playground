from datetime import datetime, timezone

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials

from ..config.secrets import get_oauth_token, store_oauth_token
from ..config.settings import settings
from ..utils.errors import AuthenticationError
from ..utils.logger import log_auth_event

_GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"


class TokenManager:
    def __init__(self) -> None:
        self._warning_seconds = settings.TOKEN_EXPIRY_WARNING_HOURS * 3600

    def load_token(self, service: str) -> dict | None:
        token_data = get_oauth_token()
        if not token_data:
            return None

        creds = self.to_credentials(token_data)

        if creds.expired and creds.refresh_token:
            log_auth_event(service, "token_expired", False)
            return self.refresh_token(service, token_data)

        if self._needs_refresh(creds) and creds.refresh_token:
            return self.refresh_token(service, token_data)

        return token_data

    def refresh_token(self, service: str, token_data: dict) -> dict:
        try:
            creds = self.to_credentials(token_data)
            creds.refresh(GoogleRequest())
            new_data = self.from_credentials(creds)
            store_oauth_token(new_data)
            log_auth_event(service, "token_refresh", True)
            return new_data
        except Exception as exc:
            log_auth_event(service, "token_refresh", False, error=str(exc))
            exc_str = str(exc).lower()
            if "invalid_grant" in exc_str or "token has been expired" in exc_str or "token has been revoked" in exc_str:
                # Refresh token is permanently invalid — clear it so the user re-authenticates.
                from ..config.secrets import clear_oauth_token
                clear_oauth_token()
                raise AuthenticationError("Google session expired — please reconnect via Settings → Google") from exc
            raise AuthenticationError(f"Token refresh failed for {service}: {exc}") from exc

    def to_credentials(self, token_data: dict) -> Credentials:
        expiry = None
        if token_data.get("expiry_date"):
            # google-auth compares expiry against datetime.utcnow() (naive), so expiry must be naive UTC.
            expiry = datetime.utcfromtimestamp(token_data["expiry_date"] / 1000)

        return Credentials(
            token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            expiry=expiry,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            token_uri=_GOOGLE_TOKEN_URI,
        )

    def from_credentials(self, creds: Credentials) -> dict:
        expiry_ms = None
        if creds.expiry:
            expiry_ms = int(creds.expiry.replace(tzinfo=timezone.utc).timestamp() * 1000)
        return {
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "expiry_date": expiry_ms,
            "token_type": "Bearer",
            "scope": " ".join(creds.scopes) if creds.scopes else "",
        }

    def _needs_refresh(self, creds: Credentials) -> bool:
        if not creds.expiry:
            return False
        remaining = (
            creds.expiry.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)
        ).total_seconds()
        return remaining < self._warning_seconds


token_manager = TokenManager()
