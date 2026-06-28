#!/usr/bin/env python3
"""Interactive OAuth2 flow — run once to authorize all Google services."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config.secrets import store_oauth_token
from src.config.settings import settings
from src.services.google_auth import ALL_SCOPES

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
except ImportError:
    print("Missing dependencies. Run: pip install -r requirements.txt")
    sys.exit(1)


def _client_config() -> dict:
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        print(
            "ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env\n"
            "  1. Go to https://console.cloud.google.com/apis/credentials\n"
            "  2. Create an OAuth 2.0 Client ID (Desktop app)\n"
            "  3. Copy the client ID and secret into your .env file"
        )
        sys.exit(1)
    return {
        "installed": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }


def main() -> None:
    print("MCP Gateway — Google OAuth2 Authorization")
    print("=" * 42)
    print("This will open a browser for you to sign in with Google.")
    print(f"Scopes requested: {len(ALL_SCOPES)} (Gmail, Calendar, Drive, Sheets)\n")

    flow = InstalledAppFlow.from_client_config(_client_config(), scopes=ALL_SCOPES)
    credentials = flow.run_local_server(port=0, prompt="consent", access_type="offline")

    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes or ALL_SCOPES),
    }

    if credentials.expiry:
        token_data["expiry"] = credentials.expiry.isoformat()

    store_oauth_token(token_data)
    print("\nAuthorization successful!")
    print("Token stored securely in the system keychain.")
    print("\nConfigured services: Gmail, Calendar, Drive, Sheets")
    print("Run the gateway with: uvicorn src.main:app --host 127.0.0.1 --port 8000")


if __name__ == "__main__":
    main()
