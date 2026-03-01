"""
MongoDB connection via Motor (async driver)
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Open the MongoDB connection and ensure indexes."""
    global _client
    _client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = _client[settings.MONGODB_DB_NAME]
    await _ensure_indexes(db)


async def close_db() -> None:
    """Close the MongoDB connection."""
    global _client
    if _client:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    """Return the active database handle (call after connect_db)."""
    if _client is None:
        raise RuntimeError("Database not initialised — call connect_db() first")
    return _client[settings.MONGODB_DB_NAME]


async def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency — yields the database handle."""
    yield get_database()


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create all necessary indexes (idempotent)."""
    from pymongo import ASCENDING, DESCENDING, IndexModel

    # users: unique email
    await db.users.create_indexes([
        IndexModel([("email", ASCENDING)], unique=True),
    ])

    # chats: filter by user, sort by updated_at
    await db.chats.create_indexes([
        IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)]),
    ])

    # chat_urls: unique per (chat_id, url_id); also index by chat_id alone
    await db.chat_urls.create_indexes([
        IndexModel([("chat_id", ASCENDING), ("url_id", ASCENDING)], unique=True),
        IndexModel([("chat_id", ASCENDING)]),
    ])

    # urls (global): _id IS url_id (string) — no extra index needed
    # But index updated_at for housekeeping queries
    await db.urls.create_indexes([
        IndexModel([("updated_at", DESCENDING)]),
    ])
