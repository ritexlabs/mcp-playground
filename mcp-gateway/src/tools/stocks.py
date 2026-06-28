from ..services.google_client_factory import get_sheets_client
from ..config.settings import settings
from ..utils.errors import ConfigurationError, ValidationError


def handle_get_stocks(symbols: list[str] | None = None) -> str:
    spreadsheet_id = settings.MYSTOCKS_SPREADSHEET_ID
    if not spreadsheet_id:
        raise ConfigurationError(
            "MYSTOCKS_SPREADSHEET_ID is not configured. "
            "Open Dashboard Settings → Stocks to select your Google Sheet."
        )

    sheet_range = settings.MYSTOCKS_RANGE or "A:Z"
    service = get_sheets_client()

    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=sheet_range)
        .execute()
    )

    rows = result.get("values", [])
    if not rows:
        return "No data found in the MyStocks spreadsheet."

    # Find the actual header row — skip merged title rows above the column names.
    header_idx = 0
    for i, row in enumerate(rows):
        if any("broker" in str(cell).lower() for cell in row):
            header_idx = i
            break

    header = [str(h).strip() for h in rows[header_idx]]
    data_rows = rows[header_idx + 1:]

    if not data_rows:
        return "The MyStocks spreadsheet has headers but no stock entries."

    if symbols:
        invalid = [s for s in symbols if not s.replace(":", "").isalpha()]
        if invalid:
            raise ValidationError(f"Invalid ticker symbols: {', '.join(invalid)}")
        upper = {s.upper() for s in symbols}
        sym_cols = [
            i for i, h in enumerate(header)
            if any(k in h.lower() for k in ("symbol", "ticker", "exchange"))
        ]
        data_rows = [
            r for r in data_rows
            if any(
                i < len(r) and any(s in r[i].upper() for s in upper)
                for i in sym_cols
            )
        ]

    sep = "| " + " | ".join("---" for _ in header) + " |"
    header_row = "| " + " | ".join(header) + " |"
    lines = [header_row, sep]
    for row in data_rows:
        cells = [str(row[i]).strip() if i < len(row) else "" for i in range(len(header))]
        lines.append("| " + " | ".join(cells) + " |")

    return "\n".join(lines)
