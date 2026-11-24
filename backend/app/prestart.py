"""One-time initialisation before the web workers start (see start.sh)."""
import asyncio

from app.main import initialize

if __name__ == "__main__":
    asyncio.run(initialize())
