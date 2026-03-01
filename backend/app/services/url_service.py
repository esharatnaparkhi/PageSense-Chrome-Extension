"""
URL service — manages the global `urls` collection.

Each URL document uses `url_id = sha256(url)[:24]` as its MongoDB `_id`,
guaranteeing exactly one document per unique URL across all users/chats.
"""
import hashlib
from datetime import datetime
from typing import Optional

from pymongo import ReturnDocument
from motor.motor_asyncio import AsyncIOMotorDatabase


def url_id(url: str) -> str:
    """Deterministic, collision-resistant 24-char ID for a URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:24]


async def get_or_create(
    db: AsyncIOMotorDatabase,
    url: str,
    full_context: str,
) -> dict:
    """Upsert a URL document with the latest full_context. Returns the document."""
    uid = url_id(url)
    now = datetime.utcnow()
    doc = await db.urls.find_one_and_update(
        {"_id": uid},
        {
            "$set": {
                "url": url,
                "full_context": full_context,
                "updated_at": now,
            },
            "$setOnInsert": {
                "summarised_context": None,
                "summarising": False,
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc


async def get_by_url(db: AsyncIOMotorDatabase, url: str) -> Optional[dict]:
    """Fetch a URL document by URL string."""
    return await db.urls.find_one({"_id": url_id(url)})


async def get_by_id(db: AsyncIOMotorDatabase, uid: str) -> Optional[dict]:
    """Fetch a URL document by its url_id."""
    return await db.urls.find_one({"_id": uid})


async def store_summarised_context(
    db: AsyncIOMotorDatabase,
    uid: str,
    summary: str,
) -> None:
    """Persist generated summary and release the summarising lock."""
    await db.urls.update_one(
        {"_id": uid},
        {
            "$set": {
                "summarised_context": summary,
                "summarising": False,
                "updated_at": datetime.utcnow(),
            }
        },
    )
