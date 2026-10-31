# BTC-NVDA Dashboard API

FastAPI service that exposes the `vw_Dashboard_*` SQL Server views to the React
frontend. Runs on port 5146 to match `API_BASE_URL` in
`src/api/dashboardApi.js`.

## Setup

```
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

The defaults in `.env.example` already match the local SQL Server instance
used by `D:\Python\Fetch_Prices.py` (Windows Trusted Connection), so most
setups won't need to edit `.env` at all.

## Run

```
uvicorn app.main:app --host 0.0.0.0 --port 5146 --reload
```

## Endpoints

- `GET /health`
- `GET /api/dashboard/overview`
- `GET /api/assets/{symbol}/price-history?hours=720`
- `GET /api/assets/{symbol}/price-stats?hours=24`
- `GET /api/assets/{symbol}/detail`
- `GET /api/assets/{symbol}/news-impact?limit=20`
- `GET /api/assets/{symbol}/track-record`
- `GET /api/assets/{symbol}/mood-track-record`
- `GET /api/assets/{symbol}/weekly-highlights?days=7&limit=5`
- `GET /api/macro/latest?hours=24`

`{symbol}` must be `BTC` or `NVDA` (case-insensitive) — anything else returns
a 404 instead of an empty/confusing result.
