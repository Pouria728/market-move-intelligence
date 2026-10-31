"""US stock market sessions, for measuring news impact on NVDA.

NVDA's recorded price only changes while the regular session is open (9:30-16:00
New York time, Mon-Fri, excluding exchange holidays) - that is under a fifth of
the week. News that breaks overnight or on a weekend can only move the price at
the next open, so its impact has to be measured from there.

All datetimes in and out are naive local times, the same clock SQL Server uses
for Record_Time / Market_Prices (the API runs on the same machine).
"""

import datetime
from zoneinfo import ZoneInfo

NEW_YORK = ZoneInfo("America/New_York")
SESSION_OPEN = datetime.time(9, 30)
SESSION_CLOSE = datetime.time(16, 0)
EARLY_CLOSE = datetime.time(13, 0)

# NYSE/Nasdaq full-day closures. Extend this each year - a missing holiday only
# makes that day's NVDA news measure as a flat (inconclusive) move.
HOLIDAYS = {
    datetime.date(2026, 1, 1), datetime.date(2026, 1, 19), datetime.date(2026, 2, 16),
    datetime.date(2026, 4, 3), datetime.date(2026, 5, 25), datetime.date(2026, 6, 19),
    datetime.date(2026, 7, 3), datetime.date(2026, 9, 7), datetime.date(2026, 11, 26),
    datetime.date(2026, 12, 25),
    datetime.date(2027, 1, 1), datetime.date(2027, 1, 18), datetime.date(2027, 2, 15),
    datetime.date(2027, 3, 26), datetime.date(2027, 5, 31), datetime.date(2027, 6, 18),
    datetime.date(2027, 7, 5), datetime.date(2027, 9, 6), datetime.date(2027, 11, 25),
    datetime.date(2027, 12, 24),
}
EARLY_CLOSE_DAYS = {
    datetime.date(2026, 11, 27), datetime.date(2026, 12, 24),
    datetime.date(2027, 11, 26),
}


def _to_new_york(local_dt: datetime.datetime) -> datetime.datetime:
    # A naive datetime's astimezone() treats it as system local time.
    return local_dt.astimezone().astimezone(NEW_YORK)


def _to_local(new_york_dt: datetime.datetime) -> datetime.datetime:
    return new_york_dt.astimezone().replace(tzinfo=None)


def is_trading_day(day: datetime.date) -> bool:
    return day.weekday() < 5 and day not in HOLIDAYS


def _session(day: datetime.date) -> tuple[datetime.datetime, datetime.datetime]:
    close = EARLY_CLOSE if day in EARLY_CLOSE_DAYS else SESSION_CLOSE
    return (
        datetime.datetime.combine(day, SESSION_OPEN, NEW_YORK),
        datetime.datetime.combine(day, close, NEW_YORK),
    )


def is_open(local_dt: datetime.datetime) -> bool:
    ny = _to_new_york(local_dt)
    if not is_trading_day(ny.date()):
        return False
    open_at, close_at = _session(ny.date())
    return open_at <= ny < close_at


def next_open(local_dt: datetime.datetime) -> datetime.datetime:
    """The first session open at or after local_dt."""
    day = _to_new_york(local_dt).date()
    while True:
        if is_trading_day(day):
            open_at, _ = _session(day)
            if _to_local(open_at) >= local_dt:
                return _to_local(open_at)
        day += datetime.timedelta(days=1)


def previous_close(local_dt: datetime.datetime) -> datetime.datetime:
    """The last session close at or before local_dt."""
    day = _to_new_york(local_dt).date()
    while True:
        if is_trading_day(day):
            _, close_at = _session(day)
            if _to_local(close_at) <= local_dt:
                return _to_local(close_at)
        day -= datetime.timedelta(days=1)


def same_time_next_trading_day(local_dt: datetime.datetime) -> datetime.datetime:
    """One trading day later at the same New York time - the stock-market
    equivalent of "24 hours later" that skips nights, weekends and holidays."""
    ny = _to_new_york(local_dt)
    day = ny.date() + datetime.timedelta(days=1)
    while not is_trading_day(day):
        day += datetime.timedelta(days=1)
    _, close_at = _session(day)
    target = datetime.datetime.combine(day, ny.time(), NEW_YORK)
    return _to_local(min(target, close_at))
