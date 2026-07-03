from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> Path:
    local = Path(__file__).parent.parent.parent / ".env"
    if local.exists():
        return local
    installed = Path.home() / ".local" / "mcp-gateway" / ".env"
    if installed.exists():
        return installed
    raise FileNotFoundError(
        ".env not found. Create one from .env.example in the mcp-gateway directory."
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="allow",
    )

    LOG_LEVEL: str = "info"

    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_OAUTH_TOKEN: str | None = None

    GITHUB_TOKEN: str | None = None
    GITHUB_USERNAME: str | None = None

    MCP_SERVER_NAME: str = "personal-secure-gateway"
    MCP_SERVER_VERSION: str = "1.0.0"
    MCP_HOST: str = "127.0.0.1"
    MCP_PORT: int = 8000

    MYSTOCKS_SPREADSHEET_ID: str | None = None
    MYSTOCKS_RANGE: str = "A:Z"

    INDMONEY_MCP_URL: str | None = "https://mcp.indmoney.com/mcp"
    INDMONEY_DISPLAY_TOOL: str | None = None
    INDMONEY_SCOPES: str = "portfolio:read market:read"
    # Auto-populated by the gateway — do not set manually
    INDMONEY_CLIENT_ID: str | None = None
    INDMONEY_CLIENT_SECRET: str | None = None
    INDMONEY_OAUTH_TOKEN: str | None = None

    # ── Gateway API token ── (authenticates the daily dashboard proxy)
    # Auto-generated on first startup if not set. Copy the printed token into
    # daily-briefing-dashboard/.env as GATEWAY_API_TOKEN=<value>
    GATEWAY_API_TOKEN: str | None = None

    # ── WhatsApp Business Cloud API ──
    WHATSAPP_ACCESS_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None
    WHATSAPP_VERIFY_TOKEN: str | None = None
    WHATSAPP_WEBHOOK_DOMAIN: str | None = None

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    TOKEN_EXPIRY_WARNING_HOURS: int = 24

    # Origin of the dashboard UI — used for CORS and postMessage target
    DASHBOARD_ORIGIN: str = "http://localhost:8080"
    # How long (seconds) an OAuth state token stays valid before expiry
    AUTH_FLOW_TTL_SECONDS: int = 300

    def is_google_configured(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    def is_whatsapp_configured(self) -> bool:
        return bool(self.WHATSAPP_ACCESS_TOKEN and self.WHATSAPP_PHONE_NUMBER_ID and self.WHATSAPP_VERIFY_TOKEN)

    def is_indmoney_configured(self) -> bool:
        return bool(self.INDMONEY_MCP_URL)

    def is_service_configured(self, service: str) -> bool:
        if service in ("gmail", "calendar", "sheets"):
            return self.is_google_configured()
        if service == "github":
            return bool(self.GITHUB_TOKEN)
        return False


settings = Settings()
