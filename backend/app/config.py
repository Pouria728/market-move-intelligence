import os

from dotenv import load_dotenv

load_dotenv()

# Connection defaults mirror D:\Python\Fetch_Prices.py so the API works out of
# the box against the same local SQL Server instance without extra setup.
DB_SERVER = os.getenv("DB_SERVER", ".")
DB_NAME = os.getenv("DB_NAME", "BTC-NVDA-Dashoard")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
DB_TRUSTED_CONNECTION = os.getenv("DB_TRUSTED_CONNECTION", "yes")

# Optional SQL auth. If either is unset, Windows Trusted Connection is used.
DB_USER = os.getenv("DB_USER") or None
DB_PASSWORD = os.getenv("DB_PASSWORD") or None

# Comma-separated list, or "*" for any origin (fine for local dev).
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# Only these symbols exist in the dashboard views today. Keeping this as an
# explicit allow-list turns a typo'd URL into a clean 404 instead of a query
# that silently returns nothing.
ALLOWED_ASSETS = {"BTC", "NVDA"}
