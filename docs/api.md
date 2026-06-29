# API Reference

All endpoints are served by the MCP Gateway at `http://127.0.0.1:8000` (default).

---

## Health

### `GET /health`

Returns gateway status. No authentication required.

**Response**
```json
{
  "status": "ok",
  "server": "personal-secure-gateway",
  "version": "1.0.0",
  "google_configured": true
}
```

---

## MCP Transport

### `GET /sse`

Opens a Server-Sent Events (SSE) stream for MCP tool discovery and execution. MCP clients (Claude Desktop, Cursor, dashboard) connect here.

### `POST /messages/`

Receives MCP protocol messages posted by SSE clients. Used internally by the MCP SDK — not called directly.

---

## Google Auth

### `GET /auth/google`

Starts the Google OAuth 2.0 flow. Redirects the browser to Google's consent screen. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

### `GET /auth/callback`

OAuth redirect URI. Google redirects here with `?code=...&state=...` after the user grants permission. The gateway exchanges the code for a token and stores it in macOS Keychain.

**Query params:** `code`, `state`, `error` (set by Google)

### `GET /auth/status`

Returns the current Google authentication state.

**Response**
```json
{
  "authenticated": true,
  "google_configured": true,
  "spreadsheet_id": null,
  "spreadsheet_name": null
}
```

> Note: `spreadsheet_id` is returned for UI purposes. It is the ID saved via `/config/sheets/{id}`, not a secret.

### `DELETE /auth/token`

Removes the stored Google OAuth token from macOS Keychain and `.env`.

**Response**
```json
{ "status": "disconnected" }
```

---

## IndMoney Auth (OAuth 2.1 + PKCE)

### `GET /auth/indmoney`

Starts the IndMoney OAuth 2.1 + PKCE flow. Dynamically registers the gateway as an OAuth client on first call (RFC 7591), then redirects the browser to IndMoney's authorization endpoint.

### `GET /auth/indmoney/callback`

OAuth redirect URI for IndMoney. Exchanges the authorization code for a token (using PKCE) and stores it in macOS Keychain.

**Query params:** `code`, `state`, `error` (set by IndMoney)

### `DELETE /auth/indmoney/token`

Removes the stored IndMoney OAuth token from macOS Keychain.

**Response**
```json
{ "status": "disconnected" }
```

---

## Config — Sheets

### `GET /config/sheets`

Lists Google Drive spreadsheets accessible to the authenticated user.

**Response** — array of file objects:
```json
[
  { "id": "<spreadsheet-id>", "name": "MyStocks", "modifiedTime": "2025-01-01T00:00:00Z" }
]
```

### `POST /config/sheets/{spreadsheet_id}`

Saves a spreadsheet ID as the active stocks sheet. The ID must match `^[A-Za-z0-9_\-]{20,60}$`.

**Response**
```json
{ "status": "saved", "spreadsheet_id": "<spreadsheet-id>" }
```

---

## Config — IndMoney

### `GET /config/indmoney/status`

Returns the IndMoney connection status and available tools.

**Response**
```json
{
  "connected": true,
  "tools": ["networth_snapshot", "indian_stocks_sips", "mf_sips"],
  "auth_configured": true,
  "url": "https://mcp.indmoney.com/mcp",
  "display_tool": "networth_snapshot",
  "oauth_configured": true
}
```

### `POST /config/indmoney/save`

Updates IndMoney configuration settings.

**Request body**
```json
{
  "url": "https://mcp.indmoney.com/mcp",
  "display_tool": "networth_snapshot"
}
```

- `url` must be a valid HTTP/HTTPS URL.
- `display_tool` must match `^[a-z0-9_]{1,60}$` (tool name without the `indmoney_` prefix).

**Response** — same as `/config/indmoney/status`.

---

## IndMoney Data

### `GET /indmoney/data`

Calls the configured `INDMONEY_DISPLAY_TOOL` and returns its text output.

**Response**
```json
{ "text": "<tool output>" }
```

### `GET /indmoney/overview`

Returns structured networth, stock SIP, and mutual fund SIP data for the dashboard card.

**Response — 200 OK**
```json
{
  "snapshot": { ... },
  "stock_sips": [ ... ],
  "mf_sips": [ ... ]
}
```

**Response — 401 Unauthorized** (token expired or invalid)
```json
{
  "auth_required": true,
  "error": "IndMoney session expired"
}
```

When `auth_required` is `true` the client should prompt the user to reconnect via `GET /auth/indmoney`.

---

## Error Format

All errors return JSON with a consistent shape:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid spreadsheet ID format"
}
```

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `AUTH_ERROR` | 401 | Not authenticated or token expired |
| `CONFIG_ERROR` | 400/500 | Missing or invalid configuration |
| `VALIDATION_ERROR` | 400 | Invalid input value |
| `RATE_LIMIT_ERROR` | 429 | Too many requests |
| `SERVICE_ERROR` | 500 | Downstream API failure |
| `TOOL_ERROR` | 500 | Unexpected tool execution error |
| `UNKNOWN_TOOL` | 404 | Tool name not registered |
