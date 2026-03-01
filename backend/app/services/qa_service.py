"""
QA service — manages the `chat_urls` collection and Q&A logic.

Architecture
------------
- Each (chat, url) pair has one `chat_urls` document.
- Q&A turns are stored atomically as embedded QAEntry objects in `qa[]`.
- For comparative questions, full_context from the global `urls` collection
  is fetched for every URL visited in the chat and returned as TextChunks.
"""
import re
from datetime import datetime
from typing import List

from pymongo import ReturnDocument
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.documents import QAEntry
from app.schemas.schemas import TextChunk
from app.services.url_service import url_id as _url_id


# ---------------------------------------------------------------------------
# Comparative question detection
# ---------------------------------------------------------------------------

_COMPARATIVE_RE = re.compile(
    r"\b(compare|comparison|versus|vs\.?|difference|differ|similar|contrast|"
    r"both|either|between|across|which is better|how does .+ compare|"
    r"what is the difference)\b",
    re.IGNORECASE,
)


def is_comparative(question: str) -> bool:
    """Return True if the question seems to request cross-page comparison."""
    return bool(_COMPARATIVE_RE.search(question))


# ---------------------------------------------------------------------------
# chat_url CRUD
# ---------------------------------------------------------------------------

async def ensure_chat_url(
    db: AsyncIOMotorDatabase,
    chat_id: str,
    url: str,
) -> dict:
    """Upsert the chat_url document for this (chat, url) pair and return it."""
    uid = _url_id(url)
    now = datetime.utcnow()
    doc = await db.chat_urls.find_one_and_update(
        {"chat_id": chat_id, "url_id": uid},
        {
            "$setOnInsert": {
                "chat_id": chat_id,
                "url_id": uid,
                "url": url,
                "qa": [],
                "created_at": now,
                "updated_at": now,
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc


async def append_qa(
    db: AsyncIOMotorDatabase,
    chat_id: str,
    url: str,
    entry: QAEntry,
) -> None:
    """Atomically push a QAEntry onto the qa array for (chat_id, url)."""
    uid = _url_id(url)
    await db.chat_urls.update_one(
        {"chat_id": chat_id, "url_id": uid},
        {
            "$push": {"qa": entry.model_dump()},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )


# ---------------------------------------------------------------------------
# Context retrieval for comparative / cross-page questions
# ---------------------------------------------------------------------------

async def get_all_chat_context(
    db: AsyncIOMotorDatabase,
    chat_id: str,
) -> List[TextChunk]:
    """
    Return one TextChunk per URL visited in this chat, built from the
    full_context stored in the global `urls` collection.
    """
    chat_urls = await db.chat_urls.find({"chat_id": chat_id}).to_list(None)
    chunks: List[TextChunk] = []
    for cu in chat_urls:
        url_doc = await db.urls.find_one({"_id": cu["url_id"]})
        if not url_doc:
            continue
        text = url_doc.get("full_context", "")
        if not text:
            continue
        chunks.append(
            TextChunk(
                id=cu["url_id"],
                text=text,
                start_char=0,
                end_char=len(text),
                source_url=cu["url"],
            )
        )
    return chunks


# ---------------------------------------------------------------------------
# Chat history reconstruction
# ---------------------------------------------------------------------------

async def get_chat_messages(
    db: AsyncIOMotorDatabase,
    chat_id: str,
) -> List[dict]:
    """
    Flatten all QA entries from every chat_url into a chronological list of
    message dicts compatible with MessageResponse schema.
    """
    chat_urls = await db.chat_urls.find({"chat_id": chat_id}).to_list(None)
    entries: List[dict] = []
    for cu in chat_urls:
        url = cu.get("url", "")
        for qa in cu.get("qa", []):
            entries.append({
                "url": url,
                "question": qa.get("question", ""),
                "answer": qa.get("answer", ""),
                "sources": qa.get("sources", []),
                "type": qa.get("type", "qa"),
                "created_at": qa.get("created_at"),
            })

    entries.sort(key=lambda e: e["created_at"] or datetime.min)

    messages: List[dict] = []
    for e in entries:
        # For QA entries, prepend the user question
        if e["question"]:
            messages.append({
                "role": "user",
                "content": e["question"],
                "url": e["url"],
                "page_title": None,
                "extra_data": {"url": e["url"], "type": e["type"]},
                "created_at": e["created_at"],
            })
        # Always append the assistant answer / summary
        messages.append({
            "role": "assistant",
            "content": e["answer"],
            "url": e["url"],
            "page_title": None,
            "extra_data": {
                "url": e["url"],
                "sources": e["sources"],
                "type": e["type"],
            },
            "created_at": e["created_at"],
        })

    return messages
