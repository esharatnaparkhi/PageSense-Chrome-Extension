"""
Summary service — generates and caches page summaries.

Uses an optimistic lock (`summarising` flag on the URL document) to
prevent duplicate LLM calls when multiple requests arrive simultaneously
for the same page.
"""
import asyncio
from datetime import datetime
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.url_service import url_id as _url_id, store_summarised_context


async def get_or_generate_summary(
    db: AsyncIOMotorDatabase,
    url: str,
    llm_service: Any,
    style: str = "short",
) -> Optional[str]:
    """
    Return an existing cached summary for `url`, or generate one via LLM.

    Flow
    ----
    1. Look up the URL document (must exist — call url_service.get_or_create first).
    2. Return cached summary if present.
    3. Claim the optimistic lock (summarising: False → True).
    4. If lock claimed: generate, store, return.
    5. If lock not claimed (another task is generating): poll briefly.
    """
    uid = _url_id(url)
    url_doc = await db.urls.find_one({"_id": uid})
    if not url_doc:
        return None

    # Already cached
    if url_doc.get("summarised_context"):
        return url_doc["summarised_context"]

    # Try to claim the lock
    from pymongo import ReturnDocument
    claimed = await db.urls.find_one_and_update(
        {"_id": uid, "summarising": False},
        {"$set": {"summarising": True, "updated_at": datetime.utcnow()}},
        return_document=ReturnDocument.BEFORE,
    )

    if claimed is None:
        # Another coroutine holds the lock — poll up to 10 s
        for _ in range(10):
            await asyncio.sleep(1)
            doc = await db.urls.find_one({"_id": uid})
            if doc and doc.get("summarised_context"):
                return doc["summarised_context"]
        return None

    # We hold the lock — generate the summary
    from app.schemas.schemas import TextChunk
    full_text = url_doc.get("full_context", "")
    chunks = [TextChunk(id="0", text=full_text, start_char=0, end_char=len(full_text))]

    try:
        result = await llm_service.summarize(chunks=chunks, style=style)
        summary = result["summary"]
    except Exception:
        # Release lock on failure
        await db.urls.update_one(
            {"_id": uid},
            {"$set": {"summarising": False, "updated_at": datetime.utcnow()}},
        )
        raise

    await store_summarised_context(db, uid, summary)
    return summary
