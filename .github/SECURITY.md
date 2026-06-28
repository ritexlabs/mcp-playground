# Security Policy

## Supported Versions

This project is a personal tool intended for local use. There is no versioned release cycle. The `main` branch is the supported version.

## Reporting a Vulnerability

If you find a security issue, please **do not open a public GitHub issue**. Instead, report it privately:

- **Email:** Use GitHub's private vulnerability reporting (Security → Report a vulnerability) on this repository.
- Include a description of the vulnerability, steps to reproduce, and potential impact.

We will acknowledge the report within 7 days and aim to release a fix within 30 days.

---

## Security Design

### Credential storage

- All secrets (Google OAuth tokens, IndMoney tokens, client credentials) are stored in **macOS Keychain** via `keyring`.
- `.env` files hold a fallback copy and are **gitignored** — they must never be committed.
- `.env.example` files contain only placeholder values — no real credentials.

### Secrets in code

- No credentials, tokens, API keys, or passwords are hardcoded.
- All sensitive config is loaded from environment variables via `pydantic-settings`.
- `sanitize_error()` redacts strings ≥ 30 characters (including `.`, `/`, `+`, `=` chars used in OAuth tokens) from all error messages and logs.

### Network exposure

- The MCP Gateway binds to `127.0.0.1` by default — not reachable from the network.
- CORS is restricted to `DASHBOARD_ORIGIN` (default: `http://localhost:8080`).
- Security headers are set on all responses: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Content-Security-Policy`, `Referrer-Policy`.

### OAuth security

- Google OAuth uses standard Authorization Code flow with offline access.
- IndMoney OAuth uses **OAuth 2.1 + PKCE** (RFC 7636) — no client secret exchanged in the browser.
- IndMoney client registration uses **Dynamic Client Registration** (RFC 7591).
- OAuth state tokens expire after `AUTH_FLOW_TTL_SECONDS` (default: 300 seconds). Stale state is rejected.
- `postMessage` in the IndMoney success page targets only `DASHBOARD_ORIGIN` — never `'*'`.

### Input validation

- Spreadsheet IDs are validated with regex `^[A-Za-z0-9_\-]{20,60}$`.
- IndMoney MCP URLs are validated with `urlparse` (must be `http` or `https`).
- Display tool names are validated with `^[a-z0-9_]{1,60}$`.

### Rate limiting

- Per-tool token-bucket rate limiter (default: 60 requests/minute) prevents runaway AI loops.

### Audit logging

- Every tool call and auth event is written to a daily JSON log at `~/.local/mcp-gateway/logs/`.
- No credential values appear in logs.

---

## Known Limitations

- Token storage uses macOS Keychain — **macOS only**. Running on Linux or Windows requires alternative secret storage.
- The gateway is not designed for multi-user or production deployments — it is a single-user local tool.
- OAuth tokens in `.env` (written automatically by the gateway) are protected only by file system permissions, not encryption at rest beyond what macOS provides.
