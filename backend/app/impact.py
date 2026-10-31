"""Measures what actually happened to price after each news signal.

This is the core of the "news impact history" feature: instead of only
showing what the AI predicted, we look up the real recorded price at the
moment of the signal and again 1h / 24h later (from Market_Prices, the same
table Fetch_Prices.py fills every ~10 minutes) and report the real percent
move - then flag whether that move agreed with the AI's Sentiment call.

For NVDA, which only trades in market sessions, news outside the session is
measured from the next open, and "24h" means one trading day later. NVDA's
move is also measured against the chip sector (SOX) over the same window, and
BTC's against the average of ETH and QQQ (crypto + risk-on sentiment), so a
sector- or market-wide move isn't mistaken for one headline's effect - the
raw move is still kept (Raw_Change_*_Percent) for comparison.
"""

import bisect
import datetime
import re
import statistics
from collections import Counter
from decimal import Decimal
from typing import Optional

from . import db, market_hours

# Ordered so the first matching category wins when text mentions more than
# one (e.g. a "chip export ban" hits both Regulation and Technology - we
# want Regulation, the more newsworthy angle, to win).
CATEGORY_RULES = [
    ("Geopolitics / War", r"\bwar\b|\bwars\b|conflict|sanction|military|invasion|missile|troops|geopolit"),
    ("Regulation / Political", r"regulat|congress|senate|president|election|lawsuit|\bsec\b|legal action|export control|white house|government|ban\b|tariff"),
    ("Macro / Fed", r"\bfed\b|federal reserve|interest rate|inflation|\bcpi\b|\bpce\b|jobs report|treasury yield|unemployment|\bgdp\b|rate cut|rate hike"),
    ("Earnings / Guidance", r"earnings|revenue|guidance|quarterly|\beps\b|beat estimates|profit margin|forecast"),
    ("Corporate Deal", r"partnership|acquisition|merger|joint venture|collaborat|contract\b|agreement|deal\b"),
    ("Institutional / ETF", r"\betf\b|institutional|whale|blackrock|fidelity|hedge fund|inflow|outflow|spot bitcoin"),
    ("Supply Chain", r"supply chain|shortage|manufactur|tsmc|foundry|capacity constraint|\bhbm\b|memory chip"),
    ("Technology / Product", r"\bchip\b|\bgpu\b|blackwell|\bcuda\b|ai chip|ai accelerator|product launch|architecture|software platform"),
]


def classify_category(*text_parts: Optional[str]) -> str:
    combined = " ".join(part for part in text_parts if part).lower()

    for label, pattern in CATEGORY_RULES:
        if re.search(pattern, combined):
            return label

    return "Market Structure"

# Stocks only trade in market sessions; crypto trades around the clock.
SESSION_TRADED_ASSETS = {"NVDA"}

# News should be judged against how the asset's broader context moved, not
# its raw price - otherwise a sector- or market-wide move gets credited (or
# blamed) on one headline. NVDA is judged against its chip sector (SOX);
# BTC has no single clean equivalent, so it's judged against the average of
# ETH (crypto bellwether) and QQQ (risk-on/risk-off proxy). Values here are
# Macro_Indicators rows; when a symbol lists more than one, their percent
# changes are averaged (only across whichever have data at that moment).
SECTOR_BENCHMARK = {"NVDA": ["SOX"], "BTC": ["ETH", "QQQ"]}

# A move has to clear roughly this many standard deviations of the asset's
# own normal noise to be treated as a real confirmation or contradiction of
# the AI's call, instead of an ordinary day-to-day wiggle - ~95% confidence,
# the standard bar in academic event studies. Applied per asset and horizon
# via ABNORMAL_RETURN_STDEV below, since "normal noise" differs by both.
SIGNIFICANCE_Z = 1.96

# Standard deviation of each asset's benchmark-adjusted (abnormal) 1h/24h
# move, measured from its full signal history (2026-10-28 snapshot - not
# live-recomputed; re-measure every few months as more history accumulates).
# A single fixed threshold (the old MEANINGFUL_MOVE_PERCENT = 0.3) turned out
# to be far too lenient for NVDA and for every 24h reading - close to the
# asset's entire normal noise band, not a real signal of anything.
ABNORMAL_RETURN_STDEV = {
    "BTC": {1: 0.195, 24: 0.956},
    "NVDA": {1: 1.043, 24: 1.986},
}

# Fallback for any asset/horizon not in the table above.
DEFAULT_MOVE_THRESHOLD = 0.3


def _move_threshold(symbol: str, horizon_hours: int) -> float:
    stdev = ABNORMAL_RETURN_STDEV.get(symbol, {}).get(horizon_hours)
    if stdev is None:
        return DEFAULT_MOVE_THRESHOLD
    return round(SIGNIFICANCE_Z * stdev, 3)

# Fetch_Prices.py records a price every ~10 minutes, but only while the PC is
# on and the task is enabled. Across a hole in the price history the "nearest"
# price can be a day away, and comparing it would invent a move that never
# happened - so a price further than this from the moment we need is missing.
MAX_PRICE_GAP = datetime.timedelta(minutes=30)


def _measurement_plan(symbol: str, event_time: datetime.datetime):
    """When to take the "before" price and the 1h / 24h "after" prices.

    Returns (start, oldest_baseline, baseline_may_follow, targets): the
    baseline is the last price at/before `start` but no older than
    `oldest_baseline`; `baseline_may_follow` allows falling back to a price
    just after `start` when none was recorded shortly before it.
    """
    hour = datetime.timedelta(hours=1)

    if symbol not in SESSION_TRADED_ASSETS:
        return event_time, event_time - MAX_PRICE_GAP, True, {
            1: event_time + hour,
            24: event_time + 24 * hour,
        }

    if market_hours.is_open(event_time):
        start = event_time
        oldest_baseline = event_time - MAX_PRICE_GAP
        baseline_may_follow = True
    else:
        # News outside the session can only move the price at the next open.
        # Every price recorded since the last close is still that close, so
        # any of them is a valid "before" price - but one taken after the open
        # already contains the reaction we want to measure.
        start = market_hours.next_open(event_time)
        oldest_baseline = market_hours.previous_close(start)
        baseline_may_follow = False

    return start, oldest_baseline, baseline_may_follow, {
        1: start + hour,
        24: market_hours.same_time_next_trading_day(start),
    }


def _to_float(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _pct_change(base: Optional[float], new: Optional[float]) -> Optional[float]:
    if base is None or new is None or base == 0:
        return None
    return round((new - base) / base * 100, 2)


def _derive_headline(article_title: Optional[str], summary: Optional[str]) -> str:
    """Older signals (generated before the n8n workflow started passing
    through Article_Title/Source_URL) have no article metadata at all, only
    an AI-written Summary. Use that as the headline instead of showing a
    meaningless 'Untitled article'."""
    title = (article_title or "").strip()
    if title:
        return title

    text = (summary or "").strip()
    if not text:
        return "Market signal"
    return text if len(text) <= 140 else text[:140].rstrip() + "…"


def _classify_outcome(
    symbol: str, sentiment: Optional[str], change_1h: Optional[float], change_24h: Optional[float]
) -> str:
    # Prefer the 24h read once it exists - it's a steadier signal than 1h noise.
    if change_24h is not None:
        return _judge_move(sentiment, change_24h, _move_threshold(symbol, 24))
    return _judge_move(sentiment, change_1h, _move_threshold(symbol, 1))


def _judge_move(sentiment: Optional[str], change: Optional[float], threshold: float) -> str:
    if change is None:
        return "Too Early"

    normalized_sentiment = (sentiment or "").strip().lower()

    if abs(change) < threshold or normalized_sentiment in ("neutral", "mixed", ""):
        return "Inconclusive"

    moved_up = change > 0

    if normalized_sentiment == "bullish":
        return "Confirmed" if moved_up else "Against Call"
    if normalized_sentiment == "bearish":
        return "Confirmed" if not moved_up else "Against Call"

    return "Inconclusive"


CONFIDENCE_BUCKETS = [
    ("Low (<0.60)", lambda c: c is not None and c < 0.60),
    ("Medium (0.60-0.80)", lambda c: c is not None and 0.60 <= c < 0.80),
    ("High (0.80+)", lambda c: c is not None and c >= 0.80),
]


def _pct(numerator: int, denominator: int) -> Optional[float]:
    return round(numerator / denominator * 100, 1) if denominator else None


def _confidence_breakdown(entries: list[dict]) -> list[dict]:
    """Does the AI's own confidence score actually mean anything? Buckets
    every decisive call (Confirmed/Against Call) by its stated confidence
    and reports the real hit rate in each bucket - the only way to tell
    whether 'high confidence' calls are worth trusting more. Takes market
    moves (or anything with Confidence and Outcome)."""
    breakdown = []

    for label, matches_bucket in CONFIDENCE_BUCKETS:
        bucket_entries = [e for e in entries if matches_bucket(e["Confidence"])]
        decisive = [e for e in bucket_entries if e["Outcome"] in ("Confirmed", "Against Call")]
        confirmed = [e for e in decisive if e["Outcome"] == "Confirmed"]
        decisive_confidences = [e["Confidence"] for e in decisive if e["Confidence"] is not None]

        breakdown.append(
            {
                "Label": label,
                "Signal_Count": len(bucket_entries),
                "Decisive_Count": len(decisive),
                "Accuracy_Percent": _pct(len(confirmed), len(decisive)),
                # The bucket's real average stated confidence (not just its
                # boundary) - shown next to its real accuracy so a user can
                # compare "what the AI said" against "what actually happened".
                "Avg_Confidence_Percent": (
                    round(statistics.mean(decisive_confidences) * 100, 1) if decisive_confidences else None
                ),
            }
        )

    return breakdown


def _expected_calibration_error(breakdown: list[dict]) -> Optional[float]:
    """The standard Expected Calibration Error: the average gap between
    stated confidence and real accuracy, weighted by how many decisive
    calls sat in each confidence bucket - in percentage points, so e.g.
    12.0 means confidence is off by about 12 points on average."""
    usable = [
        b
        for b in breakdown
        if b["Decisive_Count"] > 0 and b["Avg_Confidence_Percent"] is not None and b["Accuracy_Percent"] is not None
    ]
    total = sum(b["Decisive_Count"] for b in usable)
    if not total:
        return None

    weighted_gap = sum(
        b["Decisive_Count"] * abs(b["Accuracy_Percent"] - b["Avg_Confidence_Percent"]) for b in usable
    )
    return round(weighted_gap / total, 1)


# Signals whose measurement starts within this span of the first one are
# judged against the same stretch of price action - one market move.
MARKET_MOVE_SPAN = datetime.timedelta(hours=1)


def _group_into_market_moves(entries: list[dict]) -> list[list[dict]]:
    """Several headlines often land on the same price move: a batch saved
    together, or a weekend's worth of NVDA news all measured from Monday's
    open. Counting each of them would let one move outweigh every other day,
    so they are grouped and the group is judged once."""
    resolved = sorted(
        (e for e in entries if e["Outcome"] in ("Confirmed", "Against Call", "Inconclusive")),
        key=lambda e: e["Measured_From"],
    )

    moves = []
    move_start = None
    for entry in resolved:
        start = datetime.datetime.fromisoformat(entry["Measured_From"])
        if move_start is None or start - move_start > MARKET_MOVE_SPAN:
            moves.append([])
            move_start = start
        moves[-1].append(entry)
    return moves


def _judge_market_move(symbol: str, move: list[dict]) -> dict:
    """The AI's prevailing call on this move (more Bullish or more Bearish
    headlines) against the typical price change measured over it."""
    bullish = [e for e in move if (e["Sentiment"] or "").lower() == "bullish"]
    bearish = [e for e in move if (e["Sentiment"] or "").lower() == "bearish"]
    if len(bullish) > len(bearish):
        call, side = "Bullish", bullish
    elif len(bearish) > len(bullish):
        call, side = "Bearish", bearish
    else:
        call, side = "Neutral", move

    changes = [
        e["Change_24h_Percent"] if e["Change_24h_Percent"] is not None else e["Change_1h_Percent"]
        for e in move
    ]
    change = statistics.median(c for c in changes if c is not None)
    confidences = [e["Confidence"] for e in side if e["Confidence"] is not None]

    return {
        # The median above blends 24h and 1h reads (per-entry fallback), but
        # 24h is the common case and the steadier one - judged against that
        # horizon's threshold.
        "Outcome": _judge_move(call, change, _move_threshold(symbol, 24)),
        "Confidence": statistics.mean(confidences) if confidences else None,
    }


def compute_track_record(symbol: str) -> dict:
    """Aggregates outcomes across every signal on record for this asset -
    the honest, full-history version of 'was the AI actually right', not
    just a snapshot of the last few headlines. Each market move counts once,
    however many headlines were measured over it."""
    entries = build_news_impact(symbol, limit=100000)

    pending = Counter(e["Outcome"] for e in entries if e["Outcome"] in ("Too Early", "No Price Data"))
    moves = [_judge_market_move(symbol, move) for move in _group_into_market_moves(entries)]
    counts = Counter(move["Outcome"] for move in moves)

    resolved = len(moves)
    decisive = counts["Confirmed"] + counts["Against Call"]

    # The old per-headline figure, kept for comparison.
    signal_counts = Counter(e["Outcome"] for e in entries)
    signal_decisive = signal_counts["Confirmed"] + signal_counts["Against Call"]
    confidence_breakdown = _confidence_breakdown(moves)

    return {
        "Total_Signals": len(entries),
        "Market_Moves": resolved,
        "Decisive_Moves": decisive,
        "Confirmed": counts["Confirmed"],
        "Against_Call": counts["Against Call"],
        "Inconclusive": counts["Inconclusive"],
        "Too_Early": pending["Too Early"],
        "No_Price_Data": pending["No Price Data"],
        "Confirmed_Percent": _pct(counts["Confirmed"], resolved),
        "Against_Call_Percent": _pct(counts["Against Call"], resolved),
        "Inconclusive_Percent": _pct(counts["Inconclusive"], resolved),
        "Directional_Accuracy_Percent": _pct(counts["Confirmed"], decisive),
        "Signal_Directional_Accuracy_Percent": _pct(signal_counts["Confirmed"], signal_decisive),
        "Confidence_Breakdown": confidence_breakdown,
        "Calibration_Error_Percent": _expected_calibration_error(confidence_breakdown),
    }


def build_news_impact(symbol: str, limit: int) -> list[dict]:
    """The `limit` most recent signals, newest first - including ones whose
    outcome isn't known yet, so fresh news is never hidden behind old
    headlines that happen to have a result."""
    signals = db.fetch_all_raw(
        """
        SELECT TOP (?) ID, Sentiment, Importance, Summary,
               Record_Time, Published_Time, Confidence, Analyst_Summary, Market_Narrative,
               Short_Term_View, Long_Term_View, Source_URL, Source_Name, Article_Title
        FROM dbo.Market_Signals
        WHERE Asset_Symbol = ?
        ORDER BY COALESCE(Published_Time, Record_Time) DESC
        """,
        (limit, symbol),
    )

    if not signals:
        return []

    prices = db.fetch_all_raw(
        """
        SELECT Price, Record_Time
        FROM dbo.Market_Prices
        WHERE Asset_Symbol = ?
        ORDER BY Record_Time ASC
        """,
        (symbol,),
    )

    price_times = [p["Record_Time"] for p in prices]
    price_values = [_to_float(p["Price"]) for p in prices]
    now = datetime.datetime.now()

    def make_lookups(times, values):
        def price_before_or_at(target_dt, oldest_allowed, may_follow):
            """Last recorded value at/just before target_dt - the honest
            'before the news broke' baseline. Optionally falls back to the
            nearest point either direction if nothing was recorded shortly
            before it."""
            idx = bisect.bisect_right(times, target_dt) - 1
            if idx >= 0 and times[idx] >= oldest_allowed:
                return values[idx]
            return nearest(target_dt) if may_follow else None

        def nearest(target_dt):
            if not times:
                return None
            idx = bisect.bisect_left(times, target_dt)
            candidates = [i for i in (idx - 1, idx) if 0 <= i < len(times)]
            if not candidates:
                return None
            best = min(candidates, key=lambda i: abs((times[i] - target_dt).total_seconds()))
            if abs(times[best] - target_dt) > MAX_PRICE_GAP:
                return None
            return values[best]

        return price_before_or_at, nearest

    price_before_or_at, nearest_price = make_lookups(price_times, price_values)

    benchmark_tickers = SECTOR_BENCHMARK.get(symbol, [])
    benchmark_symbol = "+".join(benchmark_tickers) if benchmark_tickers else None
    bench_lookups = []
    for ticker in benchmark_tickers:
        bench_rows = db.fetch_all_raw(
            """
            SELECT Value, Record_Time
            FROM dbo.Macro_Indicators
            WHERE Indicator_Symbol = ?
            ORDER BY Record_Time ASC
            """,
            (ticker,),
        )
        bench_lookups.append(
            make_lookups(
                [b["Record_Time"] for b in bench_rows],
                [_to_float(b["Value"]) for b in bench_rows],
            )
        )

    entries = []

    for signal in signals:
        # Measure from when the news actually came out. A signal can be saved
        # hours after publication (feed delay, backlog of a new source), and by
        # then the market has already reacted. Older signals have no publish
        # time stored, so they fall back to when they were saved.
        event_time: datetime.datetime = signal["Published_Time"] or signal["Record_Time"]
        start, oldest_baseline, baseline_may_follow, targets = _measurement_plan(symbol, event_time)
        price_at_signal = price_before_or_at(start, oldest_baseline, baseline_may_follow)

        horizon_prices = {
            hours: nearest_price(target) if target <= now else None
            for hours, target in targets.items()
        }

        raw_change_1h = _pct_change(price_at_signal, horizon_prices.get(1))
        raw_change_24h = _pct_change(price_at_signal, horizon_prices.get(24))

        # Same before/+1h/+1day moments, but for the benchmark(s) - so we can
        # subtract out "the broader context moved" and isolate what this
        # headline actually did. When there's more than one benchmark (BTC),
        # average whichever have data at that moment - QQQ only trades market
        # hours, so an overnight/weekend BTC headline falls back to ETH
        # alone. Falls back to the raw move if nothing has data yet (history
        # only reaches back ~59 days).
        change_1h, change_24h = raw_change_1h, raw_change_24h
        bench_change_1h = bench_change_24h = None
        if bench_lookups:
            changes_1h, changes_24h = [], []
            for bench_before_or_at, bench_nearest in bench_lookups:
                bench_at_signal = bench_before_or_at(start, oldest_baseline, baseline_may_follow)
                bench_horizon = {
                    hours: bench_nearest(target) if target <= now else None
                    for hours, target in targets.items()
                }
                c1 = _pct_change(bench_at_signal, bench_horizon.get(1))
                c24 = _pct_change(bench_at_signal, bench_horizon.get(24))
                if c1 is not None:
                    changes_1h.append(c1)
                if c24 is not None:
                    changes_24h.append(c24)

            if changes_1h:
                bench_change_1h = sum(changes_1h) / len(changes_1h)
            if changes_24h:
                bench_change_24h = sum(changes_24h) / len(changes_24h)
            if raw_change_1h is not None and bench_change_1h is not None:
                change_1h = round(raw_change_1h - bench_change_1h, 2)
            if raw_change_24h is not None and bench_change_24h is not None:
                change_24h = round(raw_change_24h - bench_change_24h, 2)

        outcome = _classify_outcome(symbol, signal["Sentiment"], change_1h, change_24h)
        if outcome == "Too Early" and targets[1] <= now:
            # The hour has passed - the move can't be judged because prices
            # weren't being recorded around the news, not because it's recent.
            outcome = "No Price Data"

        headline = _derive_headline(signal["Article_Title"], signal["Summary"])

        entries.append(
            {
                "Signal_ID": signal["ID"],
                "Article_Title": headline,
                "Source_Name": signal["Source_Name"] or "AI Market Analysis",
                "Source_URL": signal["Source_URL"],
                "Event_Time": event_time.isoformat(),
                "Measured_From": start.isoformat(),
                "Category": classify_category(
                    headline, signal["Summary"], signal["Analyst_Summary"], signal["Market_Narrative"]
                ),
                "Sentiment": signal["Sentiment"],
                "Importance": signal["Importance"],
                "Confidence": _to_float(signal["Confidence"]),
                "Summary": signal["Summary"],
                "Analyst_Summary": signal["Analyst_Summary"],
                "Market_Narrative": signal["Market_Narrative"],
                "Short_Term_View": signal["Short_Term_View"],
                "Long_Term_View": signal["Long_Term_View"],
                "Price_At_Signal": price_at_signal,
                "Price_1h_After": horizon_prices.get(1),
                "Price_24h_After": horizon_prices.get(24),
                "Change_1h_Percent": change_1h,
                "Change_24h_Percent": change_24h,
                "Raw_Change_1h_Percent": raw_change_1h,
                "Raw_Change_24h_Percent": raw_change_24h,
                "Benchmark_Symbol": benchmark_symbol if bench_change_1h is not None or bench_change_24h is not None else None,
                "Benchmark_Change_1h_Percent": bench_change_1h,
                "Benchmark_Change_24h_Percent": bench_change_24h,
                "Outcome": outcome,
            }
        )

    return entries


# How far back "this week" looks, and how many headlines land in it - kept
# generous so a slow news week still returns something and a busy one still
# gets ranked, not truncated before ranking.
WEEKLY_HIGHLIGHTS_LOOKBACK_DAYS = 7
WEEKLY_HIGHLIGHTS_SOURCE_LIMIT = 150


_IMPORTANCE_RANK = {"High": 2, "Medium": 1, "Low": 0}


def _impact_score(entry: dict) -> Optional[float]:
    chosen = entry["Change_24h_Percent"]
    if chosen is None:
        chosen = entry["Change_1h_Percent"]
    return abs(chosen) if chosen is not None else None


def build_weekly_highlights(symbol: str, days: int = WEEKLY_HIGHLIGHTS_LOOKBACK_DAYS, top_n: int = 5) -> list[dict]:
    """Which headlines actually moved price the most this week, after
    benchmark adjustment - the dashboard's core claim (that it reads news
    impact better than a generic chart) made concrete. Ranked by the 24h
    read, the steadier of the two measurements, falling back to 1h for
    headlines too recent to have a 24h read yet.

    Several headlines often share one measured move (a batch saved together,
    or a weekend's worth of NVDA news all measured from Monday's open) - they
    end up with identical Price_At_Signal/+1h/+24h and so an identical score.
    Showing all of them would make the leaderboard 5 copies of the same move
    instead of 5 distinct ones, so only the most newsworthy headline per
    shared move (highest Importance, earliest as a tiebreak) represents it."""
    entries = build_news_impact(symbol, limit=WEEKLY_HIGHLIGHTS_SOURCE_LIMIT)
    cutoff = datetime.datetime.now() - datetime.timedelta(days=days)

    recent = [e for e in entries if datetime.datetime.fromisoformat(e["Event_Time"]) >= cutoff]
    recent.sort(key=lambda e: e["Measured_From"])

    groups: list[list[dict]] = []
    group_start = None
    for entry in recent:
        start = datetime.datetime.fromisoformat(entry["Measured_From"])
        if group_start is None or start - group_start > MARKET_MOVE_SPAN:
            groups.append([])
            group_start = start
        groups[-1].append(entry)

    candidates = []
    for group in groups:
        representative = min(
            group,
            key=lambda e: (-_IMPORTANCE_RANK.get(e["Importance"], 0), e["Event_Time"]),
        )
        score = _impact_score(representative)
        if score is None:
            continue
        candidates.append((score, representative))

    candidates.sort(key=lambda pair: pair[0], reverse=True)
    return [entry for _, entry in candidates[:top_n]]


def build_mood_impact(symbol: str, limit: int) -> list[dict]:
    """Mirrors build_news_impact's price/benchmark measurement, but for
    Market_Mood rows instead of Market_Signals - the overall mood snapshot's
    own Mood_Sentiment judged against what price actually did afterward,
    completely separate from the per-headline track record. Mood_Sentiment
    is a newer column (added once the Mood_Confidence-vs-signal-Confidence
    mismatch was found); rows recorded before it was added have it NULL and
    are skipped here rather than counted as an unclassified 'Inconclusive'."""
    moods = db.fetch_all_raw(
        """
        SELECT TOP (?) ID, Market_Mood, Mood_Sentiment, Confidence, Record_Time
        FROM dbo.Market_Mood
        WHERE Asset_Symbol = ? AND Mood_Sentiment IS NOT NULL
        ORDER BY Record_Time DESC
        """,
        (limit, symbol),
    )

    if not moods:
        return []

    prices = db.fetch_all_raw(
        """
        SELECT Price, Record_Time
        FROM dbo.Market_Prices
        WHERE Asset_Symbol = ?
        ORDER BY Record_Time ASC
        """,
        (symbol,),
    )

    price_times = [p["Record_Time"] for p in prices]
    price_values = [_to_float(p["Price"]) for p in prices]
    now = datetime.datetime.now()

    def make_lookups(times, values):
        def price_before_or_at(target_dt, oldest_allowed, may_follow):
            idx = bisect.bisect_right(times, target_dt) - 1
            if idx >= 0 and times[idx] >= oldest_allowed:
                return values[idx]
            return nearest(target_dt) if may_follow else None

        def nearest(target_dt):
            if not times:
                return None
            idx = bisect.bisect_left(times, target_dt)
            candidates = [i for i in (idx - 1, idx) if 0 <= i < len(times)]
            if not candidates:
                return None
            best = min(candidates, key=lambda i: abs((times[i] - target_dt).total_seconds()))
            if abs(times[best] - target_dt) > MAX_PRICE_GAP:
                return None
            return values[best]

        return price_before_or_at, nearest

    price_before_or_at, nearest_price = make_lookups(price_times, price_values)

    benchmark_tickers = SECTOR_BENCHMARK.get(symbol, [])
    benchmark_symbol = "+".join(benchmark_tickers) if benchmark_tickers else None
    bench_lookups = []
    for ticker in benchmark_tickers:
        bench_rows = db.fetch_all_raw(
            """
            SELECT Value, Record_Time
            FROM dbo.Macro_Indicators
            WHERE Indicator_Symbol = ?
            ORDER BY Record_Time ASC
            """,
            (ticker,),
        )
        bench_lookups.append(
            make_lookups(
                [b["Record_Time"] for b in bench_rows],
                [_to_float(b["Value"]) for b in bench_rows],
            )
        )

    entries = []

    for mood in moods:
        event_time: datetime.datetime = mood["Record_Time"]
        start, oldest_baseline, baseline_may_follow, targets = _measurement_plan(symbol, event_time)
        price_at_signal = price_before_or_at(start, oldest_baseline, baseline_may_follow)

        horizon_prices = {
            hours: nearest_price(target) if target <= now else None
            for hours, target in targets.items()
        }

        raw_change_1h = _pct_change(price_at_signal, horizon_prices.get(1))
        raw_change_24h = _pct_change(price_at_signal, horizon_prices.get(24))

        change_1h, change_24h = raw_change_1h, raw_change_24h
        bench_change_1h = bench_change_24h = None
        if bench_lookups:
            changes_1h, changes_24h = [], []
            for bench_before_or_at, bench_nearest in bench_lookups:
                bench_at_signal = bench_before_or_at(start, oldest_baseline, baseline_may_follow)
                bench_horizon = {
                    hours: bench_nearest(target) if target <= now else None
                    for hours, target in targets.items()
                }
                c1 = _pct_change(bench_at_signal, bench_horizon.get(1))
                c24 = _pct_change(bench_at_signal, bench_horizon.get(24))
                if c1 is not None:
                    changes_1h.append(c1)
                if c24 is not None:
                    changes_24h.append(c24)

            if changes_1h:
                bench_change_1h = sum(changes_1h) / len(changes_1h)
            if changes_24h:
                bench_change_24h = sum(changes_24h) / len(changes_24h)
            if raw_change_1h is not None and bench_change_1h is not None:
                change_1h = round(raw_change_1h - bench_change_1h, 2)
            if raw_change_24h is not None and bench_change_24h is not None:
                change_24h = round(raw_change_24h - bench_change_24h, 2)

        outcome = _classify_outcome(symbol, mood["Mood_Sentiment"], change_1h, change_24h)
        if outcome == "Too Early" and targets[1] <= now:
            outcome = "No Price Data"

        entries.append(
            {
                "Mood_ID": mood["ID"],
                "Market_Mood": mood["Market_Mood"],
                "Event_Time": event_time.isoformat(),
                "Measured_From": start.isoformat(),
                "Sentiment": mood["Mood_Sentiment"],
                "Confidence": _to_float(mood["Confidence"]),
                "Price_At_Signal": price_at_signal,
                "Price_1h_After": horizon_prices.get(1),
                "Price_24h_After": horizon_prices.get(24),
                "Change_1h_Percent": change_1h,
                "Change_24h_Percent": change_24h,
                "Outcome": outcome,
            }
        )

    return entries


def compute_mood_track_record(symbol: str) -> dict:
    """Same aggregation as compute_track_record, but for the overall market
    mood snapshot's own Mood_Sentiment + Mood_Confidence rather than
    per-headline signals - so the Confidence number shown at the top of the
    dashboard finally has its own, correctly-matched accuracy history
    instead of borrowing (or going without) one."""
    entries = build_mood_impact(symbol, limit=100000)

    pending = Counter(e["Outcome"] for e in entries if e["Outcome"] in ("Too Early", "No Price Data"))
    moves = [_judge_market_move(symbol, move) for move in _group_into_market_moves(entries)]
    counts = Counter(move["Outcome"] for move in moves)

    resolved = len(moves)
    decisive = counts["Confirmed"] + counts["Against Call"]
    confidence_breakdown = _confidence_breakdown(moves)

    return {
        "Total_Signals": len(entries),
        "Market_Moves": resolved,
        "Decisive_Moves": decisive,
        "Confirmed": counts["Confirmed"],
        "Against_Call": counts["Against Call"],
        "Inconclusive": counts["Inconclusive"],
        "Too_Early": pending["Too Early"],
        "No_Price_Data": pending["No Price Data"],
        "Confirmed_Percent": _pct(counts["Confirmed"], resolved),
        "Against_Call_Percent": _pct(counts["Against Call"], resolved),
        "Inconclusive_Percent": _pct(counts["Inconclusive"], resolved),
        "Directional_Accuracy_Percent": _pct(counts["Confirmed"], decisive),
        "Confidence_Breakdown": confidence_breakdown,
        "Calibration_Error_Percent": _expected_calibration_error(confidence_breakdown),
    }
