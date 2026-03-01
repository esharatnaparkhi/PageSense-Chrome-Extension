"""
Summarization endpoints (MongoDB version)
"""
import hashlib

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.redis_client import get_cache, set_cache, increment_rate_limit
from app.schemas.schemas import SummarizeRequest, SummarizeResponse
from app.services.llm_service import LLMService
from app.models.documents import QAEntry
from app.core.config import settings
import app.services.chat_service as chat_svc
import app.services.qa_service as qa_svc
import app.services.url_service as url_svc

router = APIRouter()


@router.post("/", response_model=SummarizeResponse)
async def summarize_content(
    request: SummarizeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Summarize web page content with Redis caching and MongoDB persistence."""
    user_id = current_user["user_id"]

    # Rate limiting
    rate_key = f"rate_limit:summarize:{user_id}"
    count = await increment_rate_limit(rate_key, 60)
    if count > settings.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")

    if not request.chunks:
        raise HTTPException(status_code=400, detail="No content chunks provided")

    # Redis cache check (keyed by content hash + style)
    chunk_hash = hashlib.md5(
        "".join(c.text for c in request.chunks).encode()
    ).hexdigest()
    cache_key = hashlib.md5(
        f"summary:{user_id}:{chunk_hash}:{request.summary_style}".encode()
    ).hexdigest()
    cached = await get_cache(cache_key)
    if cached:
        return SummarizeResponse(**cached)

    # Persist full_context so comparative QA can use it later
    if request.url:
        full_context = "\n\n".join(c.text for c in request.chunks)
        await url_svc.get_or_create(db, request.url, full_context)

    # Verify the chat belongs to this user
    if request.chat_id:
        chat = await chat_svc.get_chat(db, request.chat_id, user_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

    llm_service = LLMService()
    try:
        result = await llm_service.summarize(
            chunks=request.chunks,
            style=request.summary_style,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

    response = SummarizeResponse(
        summary=result["summary"],
        sources=result["sources"],
        cost_estimate=0.001,
        response_time_ms=result["response_time_ms"],
    )

    # Cache in Redis
    await set_cache(cache_key, response.model_dump())

    # Store the summary in the global urls collection
    if request.url:
        uid = url_svc.url_id(request.url)
        await url_svc.store_summarised_context(db, uid, result["summary"])

    # Append as a QA entry (type="summary") and bump the chat
    if request.chat_id and request.url:
        await qa_svc.ensure_chat_url(db, request.chat_id, request.url)
        entry = QAEntry(
            question="",            # summaries have no explicit user question
            answer=result["summary"],
            sources=[s.model_dump() for s in result["sources"]],
            type="summary",
        )
        await qa_svc.append_qa(db, request.chat_id, request.url, entry)
        await chat_svc.touch_chat(db, request.chat_id)

    return response
