"""Live market indices via yfinance (handles Yahoo Finance auth automatically)."""
import asyncio
import yfinance as yf

INDICES = [
    {"symbol": "^NSEI",    "label": "NIFTY 50"},
    {"symbol": "^NSEBANK", "label": "BANKNIFTY"},
    {"symbol": "^BSESN",   "label": "SENSEX"},
]


def _sync_fetch(symbol: str, label: str) -> dict | None:
    try:
        fi = yf.Ticker(symbol).fast_info
        price = getattr(fi, "last_price", None) or getattr(fi, "regular_market_price", None)
        prev  = getattr(fi, "previous_close", None) or price
        if not price:
            return None
        change  = round(float(price) - float(prev or price), 2)
        pct     = round((change / float(prev) * 100) if prev else 0, 2)
        high    = getattr(fi, "day_high",  None)
        low     = getattr(fi, "day_low",   None)
        return {
            "label":     label,
            "price":     round(float(price), 2),
            "change":    change,
            "changePct": pct,
            "high":      round(float(high  or price), 2),
            "low":       round(float(low   or price), 2),
        }
    except Exception:
        return None


async def fetch_indices() -> list[dict]:
    loop = asyncio.get_event_loop()
    results = await asyncio.gather(*[
        loop.run_in_executor(None, _sync_fetch, idx["symbol"], idx["label"])
        for idx in INDICES
    ])
    return [r for r in results if r is not None]
