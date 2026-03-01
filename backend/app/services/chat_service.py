"""
Chat service — manages the `chats` collection.
"""
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException
from pymongo import DESCENDING
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings


def _str_id(doc: dict) -> dict:
    """Replace `_id` ObjectId with string `id`. Mutates and returns doc."""
    doc["id"] = str(doc.pop("_id"))
    return doc


async def create_chat(
    db: AsyncIOMotorDatabase,
    user_id: str,
    title: str = "New Chat",
) -> dict:
    """Create a chat; enforces MAX_CHATS_PER_USER limit."""
    count = await db.chats.count_documents({"user_id": user_id})
    if count >= settings.MAX_CHATS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Maximum of {settings.MAX_CHATS_PER_USER} chats allowed per user. "
                "Please delete an existing chat first."
            ),
        )
    now = datetime.utcnow()
    doc = {
        "user_id": user_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.chats.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _str_id(doc)


async def list_chats(db: AsyncIOMotorDatabase, user_id: str) -> list[dict]:
    """Return all chats for a user (newest first), with message counts."""
    chats = await (
        db.chats
        .find({"user_id": user_id})
        .sort("updated_at", DESCENDING)
        .to_list(None)
    )
    for chat in chats:
        chat_id = str(chat["_id"])
        pipeline = [
            {"$match": {"chat_id": chat_id}},
            {"$project": {"count": {"$size": "$qa"}}},
            {"$group": {"_id": None, "total": {"$sum": "$count"}}},
        ]
        agg = await db.chat_urls.aggregate(pipeline).to_list(1)
        chat["message_count"] = agg[0]["total"] if agg else 0
        _str_id(chat)
    return chats


async def get_chat(
    db: AsyncIOMotorDatabase,
    chat_id: str,
    user_id: str,
) -> Optional[dict]:
    """Fetch a single chat belonging to the user."""
    try:
        doc = await db.chats.find_one(
            {"_id": ObjectId(chat_id), "user_id": user_id}
        )
    except Exception:
        return None
    return _str_id(doc) if doc else None


async def delete_chat(
    db: AsyncIOMotorDatabase,
    chat_id: str,
    user_id: str,
) -> bool:
    """Delete chat and all associated chat_url records."""
    try:
        result = await db.chats.delete_one(
            {"_id": ObjectId(chat_id), "user_id": user_id}
        )
    except Exception:
        return False
    if result.deleted_count == 0:
        return False
    await db.chat_urls.delete_many({"chat_id": chat_id})
    return True


async def update_chat_title(
    db: AsyncIOMotorDatabase,
    chat_id: str,
    user_id: str,
    title: str,
) -> bool:
    """Update chat title. Returns True if modified."""
    try:
        result = await db.chats.update_one(
            {"_id": ObjectId(chat_id), "user_id": user_id},
            {"$set": {"title": title, "updated_at": datetime.utcnow()}},
        )
    except Exception:
        return False
    return result.modified_count > 0


async def touch_chat(db: AsyncIOMotorDatabase, chat_id: str) -> None:
    """Bump updated_at so the chat floats to the top of list_chats."""
    try:
        await db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"updated_at": datetime.utcnow()}},
        )
    except Exception:
        pass
