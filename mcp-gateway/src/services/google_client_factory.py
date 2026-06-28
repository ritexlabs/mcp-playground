from googleapiclient.discovery import build

from ..config.settings import settings
from ..services.google_auth import get_google_credentials
from ..utils.errors import AuthenticationError, ServiceError


def _build(config_service: str, api: str, version: str):
    if not settings.is_service_configured(config_service):
        raise AuthenticationError(f"{config_service} is not configured")
    try:
        creds = get_google_credentials(config_service)
        return build(api, version, credentials=creds)
    except AuthenticationError:
        raise
    except Exception as exc:
        raise ServiceError(config_service, str(exc)) from exc


def get_gmail_client():
    return _build("gmail", "gmail", "v1")


def get_calendar_client():
    return _build("calendar", "calendar", "v3")


def get_sheets_client():
    return _build("sheets", "sheets", "v4")


def get_drive_client():
    return _build("sheets", "drive", "v3")
