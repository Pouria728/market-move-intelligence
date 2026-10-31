import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import config, db, impact, macro

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dashboard_api")

app = FastAPI(title="BTC-NVDA Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if config.CORS_ORIGINS == "*" else [o.strip() for o in config.CORS_ORIGINS.split(",")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _validate_symbol(symbol: str) -> str:
    upper = symbol.upper()
    if upper not in config.ALLOWED_ASSETS:
        raise HTTPException(status_code=404, detail=f"Unknown asset symbol '{symbol}'.")
    return upper


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    # A DB hiccup (SQL Server restart, driver issue, etc.) should surface as a
    # clean 503 instead of a raw stack trace leaking to the browser.
    logger.exception("Unhandled error for %s", request.url)
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=503,
        content={"detail": "Dashboard data is temporarily unavailable. Please try again shortly."},
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/dashboard/overview")
def get_overview():
    """One row per asset: current price, 24h stats, and the latest market mood."""
    return db.fetch_all("SELECT * FROM dbo.vw_Dashboard_AssetOverview ORDER BY Asset_Symbol")


@app.get("/api/assets/{symbol}/price-history")
def get_price_history(
    symbol: str,
    hours: int = Query(24 * 30, ge=1, le=24 * 365, description="Hours of history to return"),
):
    upper = _validate_symbol(symbol)
    return db.fetch_all(
        """
        SELECT Asset_Symbol, Price, Record_Time
        FROM dbo.vw_Dashboard_PriceHistory
        WHERE Asset_Symbol = ?
          AND Record_Time >= DATEADD(HOUR, ?, GETDATE())
        ORDER BY Record_Time ASC
        """,
        (upper, -hours),
    )


@app.get("/api/assets/{symbol}/price-stats")
def get_price_stats(
    symbol: str,
    hours: int = Query(24, ge=1, le=24 * 30, description="Hours of history to aggregate over"),
):
    """Avg/Max/Min price and tick count over a caller-chosen window, instead
    of the fixed 24h window baked into vw_Dashboard_AssetOverview - lets the
    frontend offer a 24h/7d/30d toggle on top of the same raw price ticks."""
    upper = _validate_symbol(symbol)
    row = db.fetch_one(
        """
        SELECT
            AVG(Price) AS Avg_Price,
            MAX(Price) AS Max_Price,
            MIN(Price) AS Min_Price,
            COUNT(*) AS Price_Records
        FROM dbo.Market_Prices
        WHERE Asset_Symbol = ?
          AND Record_Time >= DATEADD(HOUR, ?, GETDATE())
        """,
        (upper, -hours),
    )
    return row


@app.get("/api/assets/{symbol}/detail")
def get_asset_detail(symbol: str):
    upper = _validate_symbol(symbol)
    row = db.fetch_one(
        "SELECT * FROM dbo.vw_Dashboard_AssetDetail WHERE Asset_Symbol = ?",
        (upper,),
    )

    if row is None:
        raise HTTPException(status_code=404, detail=f"No detail data available yet for '{upper}'.")

    return row


@app.get("/api/assets/{symbol}/news-impact")
def get_news_impact(
    symbol: str,
    limit: int = Query(20, ge=1, le=100),
):
    """For each recent news signal: the real price right before it, 1h and
    24h later, the actual percent move, and whether that move Confirmed or
    went Against the AI's Bullish/Bearish call."""
    upper = _validate_symbol(symbol)
    return impact.build_news_impact(upper, limit)


@app.get("/api/assets/{symbol}/track-record")
def get_track_record(symbol: str):
    """How often the AI's Bullish/Bearish calls have actually been confirmed
    by real price movement, across every signal on record for this asset."""
    upper = _validate_symbol(symbol)
    return impact.compute_track_record(upper)


@app.get("/api/assets/{symbol}/mood-track-record")
def get_mood_track_record(symbol: str):
    """Same idea as /track-record, but for the overall Market Mood snapshot's
    own Mood_Sentiment + Mood_Confidence - the number shown at the top of the
    dashboard - rather than per-headline signals."""
    upper = _validate_symbol(symbol)
    return impact.compute_mood_track_record(upper)


@app.get("/api/assets/{symbol}/weekly-highlights")
def get_weekly_highlights(
    symbol: str,
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(5, ge=1, le=20),
):
    """The headlines from the last `days` days that moved price the most
    (after benchmark adjustment) - this week's biggest news-driven moves."""
    upper = _validate_symbol(symbol)
    return impact.build_weekly_highlights(upper, days=days, top_n=limit)


@app.get("/api/macro/latest")
def get_macro_latest(
    hours: int = Query(24, ge=1, le=24 * 30, description="Hours back to compare the current value against"),
):
    """Current snapshot of the rate/broad-market backdrop (S&P 500, Nasdaq,
    VIX, 10-year Treasury yield, 3-month T-bill yield) shared by both assets,
    plus how much each has moved over the last `hours` - the same 24h/7d/30d
    window the per-asset price stats use."""
    return macro.get_latest_snapshot(hours)
