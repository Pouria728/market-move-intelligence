"""Macro/rate context shared by both BTC and NVDA - the interest-rate and
broad-market backdrop that a single news article never mentions on its own,
even though it is often the biggest driver of both assets. Filled by
D:\\Python\\Fetch_Prices.py via yfinance (no API key needed) into
Macro_Indicators.

Macro_Indicators also holds the per-asset benchmark tickers (ETH, QQQ, SOX)
used internally by impact.py's benchmark adjustment - those are a different
thing (a sector/market proxy for one asset) from this page's backdrop (the
broad economy, shared by both), so they're deliberately excluded below.
"""

import datetime
from typing import Optional

from . import db

LABELS = {
    "SP500": "S&P 500",
    "NASDAQ": "Nasdaq Composite",
    "VIX": "VIX (Volatility Index)",
    "US10Y": "10-Year Treasury Yield",
    "US3M": "3-Month T-Bill Yield",
}


def _snapshot_at_or_before(cutoff: Optional[datetime.datetime]) -> dict[str, dict]:
    """Each tracked indicator's latest row at or before `cutoff` (None =
    unbounded, i.e. the current value), keyed by symbol."""
    placeholders = ", ".join("?" for _ in LABELS)

    if cutoff is None:
        rows = db.fetch_all(
            f"""
            SELECT m.Indicator_Symbol, m.Value, m.Record_Time
            FROM dbo.Macro_Indicators m
            WHERE m.Indicator_Symbol IN ({placeholders})
              AND m.Record_Time = (
                  SELECT MAX(Record_Time) FROM dbo.Macro_Indicators m2
                  WHERE m2.Indicator_Symbol = m.Indicator_Symbol
              )
            """,
            tuple(LABELS.keys()),
        )
    else:
        rows = db.fetch_all(
            f"""
            SELECT m.Indicator_Symbol, m.Value, m.Record_Time
            FROM dbo.Macro_Indicators m
            WHERE m.Indicator_Symbol IN ({placeholders})
              AND m.Record_Time = (
                  SELECT MAX(Record_Time) FROM dbo.Macro_Indicators m2
                  WHERE m2.Indicator_Symbol = m.Indicator_Symbol AND m2.Record_Time <= ?
              )
            """,
            tuple(LABELS.keys()) + (cutoff,),
        )

    return {row["Indicator_Symbol"]: row for row in rows}


def get_latest_snapshot(hours: int = 24) -> list[dict]:
    """Current value of each tracked indicator, plus how much it's moved
    over the last `hours`. A bare level (e.g. "VIX: 18.6") means nothing to
    a reader without a reference point, so every indicator carries its own
    change alongside it - the same reason price-stats added a time window
    instead of just showing a raw number."""
    now = datetime.datetime.now()
    current = _snapshot_at_or_before(None)
    baseline = _snapshot_at_or_before(now - datetime.timedelta(hours=hours))

    results = []
    for symbol, label in LABELS.items():
        cur = current.get(symbol)
        if cur is None:
            continue

        base = baseline.get(symbol)
        value = cur["Value"]
        base_value = base["Value"] if base else None
        change = round(value - base_value, 4) if base_value is not None else None
        change_percent = (
            round((value - base_value) / abs(base_value) * 100, 2)
            if base_value not in (None, 0)
            else None
        )

        results.append(
            {
                "Symbol": symbol,
                "Label": label,
                "Value": value,
                "Record_Time": cur["Record_Time"],
                "Change": change,
                "Change_Percent": change_percent,
                # Lets the frontend be honest when the window outruns this
                # indicator's own history (e.g. a 30D view on data that only
                # goes back 3 weeks) instead of silently comparing against
                # whatever the oldest row happens to be.
                "Baseline_Record_Time": base["Record_Time"] if base else None,
            }
        )

    return sorted(results, key=lambda r: r["Symbol"])
