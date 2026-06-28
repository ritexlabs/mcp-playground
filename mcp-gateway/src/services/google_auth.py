from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

from ..config.secrets import get_oauth_token, store_oauth_token
from ..config.settings import settings
from ..auth.token_manager import token_manager
from ..utils.errors import AuthenticationError
from ..utils.logger import log_auth_event

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]
ALL_SCOPES = [*GMAIL_SCOPES, *CALENDAR_SCOPES, *SHEETS_SCOPES]

_SCOPES: dict[str, list[str]] = {
    "gmail": GMAIL_SCOPES,
    "calendar": CALENDAR_SCOPES,
    "sheets": SHEETS_SCOPES,
}


def get_google_credentials(service: str) -> Credentials:
    if not settings.is_google_configured():
        raise AuthenticationError(
            f"{service} requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
        )
    if service not in _SCOPES:
        raise AuthenticationError(f"Unknown Google service: {service}")

    token_data = token_manager.load_token(service)

    if not token_data:
        log_auth_event(service, "login", False, reason="no_token")
        client_config = {
            "installed": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"],
            }
        }
        flow = InstalledAppFlow.from_client_config(client_config, ALL_SCOPES)
        creds = flow.run_local_server(port=3000, prompt="consent")
        token_data = token_manager.from_credentials(creds)
        store_oauth_token(token_data)
        log_auth_event(service, "login", True)

    return token_manager.to_credentials(token_data)
