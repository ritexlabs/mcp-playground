import json
import re
from pathlib import Path

import keyring

SERVICE_NAME = "mcp-gateway"
GOOGLE_TOKEN_ACCOUNT = "google-oauth-token"
INDMONEY_TOKEN_ACCOUNT = "indmoney-oauth-token"


def _env_path() -> Path | None:
    from .settings import _find_env_file
    try:
        return _find_env_file()
    except FileNotFoundError:
        return None


def _update_env_file(key: str, value: str) -> None:
    path = _env_path()
    if not path:
        return
    content = path.read_text()
    new_line = f"{key}='{value}'" if value else f"{key}="
    if re.search(rf"^{re.escape(key)}=", content, re.MULTILINE):
        content = re.sub(rf"^{re.escape(key)}=.*", new_line, content, flags=re.MULTILINE)
    else:
        content = content.rstrip("\n") + f"\n{new_line}\n"
    path.write_text(content)


def store_oauth_token(token_data: dict) -> None:
    from .settings import settings
    token_str = json.dumps(token_data)
    keyring.set_password(SERVICE_NAME, GOOGLE_TOKEN_ACCOUNT, token_str)
    _update_env_file("GOOGLE_OAUTH_TOKEN", token_str)
    settings.GOOGLE_OAUTH_TOKEN = token_str


def get_oauth_token() -> dict | None:
    token_str = keyring.get_password(SERVICE_NAME, GOOGLE_TOKEN_ACCOUNT)
    if token_str:
        return json.loads(token_str)

    from .settings import settings
    env_token = settings.GOOGLE_OAUTH_TOKEN
    if env_token and env_token.strip():
        return json.loads(env_token)

    return None


def clear_oauth_token() -> None:
    from .settings import settings
    try:
        keyring.delete_password(SERVICE_NAME, GOOGLE_TOKEN_ACCOUNT)
    except keyring.errors.PasswordDeleteError:
        pass
    _update_env_file("GOOGLE_OAUTH_TOKEN", "")
    settings.GOOGLE_OAUTH_TOKEN = None


def update_env_setting(key: str, value: str) -> None:
    _update_env_file(key, value)


def store_indmoney_token(token_data: dict) -> None:
    from .settings import settings
    token_str = json.dumps(token_data)
    keyring.set_password(SERVICE_NAME, INDMONEY_TOKEN_ACCOUNT, token_str)
    _update_env_file("INDMONEY_OAUTH_TOKEN", token_str)
    settings.INDMONEY_OAUTH_TOKEN = token_str


def get_indmoney_token() -> dict | None:
    token_str = keyring.get_password(SERVICE_NAME, INDMONEY_TOKEN_ACCOUNT)
    if token_str:
        return json.loads(token_str)
    from .settings import settings
    env_token = settings.INDMONEY_OAUTH_TOKEN
    if env_token and env_token.strip():
        return json.loads(env_token)
    return None


def clear_indmoney_token() -> None:
    from .settings import settings
    try:
        keyring.delete_password(SERVICE_NAME, INDMONEY_TOKEN_ACCOUNT)
    except keyring.errors.PasswordDeleteError:
        pass
    _update_env_file("INDMONEY_OAUTH_TOKEN", "")
    settings.INDMONEY_OAUTH_TOKEN = None
