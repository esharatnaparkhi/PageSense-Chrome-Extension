"""
Question & Answer endpoints (MongoDB version)
"""
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.redis_client import increment_rate_limit
from app.schemas.schemas import QARequest, QAResponse, ChatMessage
from app.services.llm_service import LLMService
from app.models.documents import QAEntry
from app.core.config import settings
import app.services.chat_service as chat_svc
import app.services.qa_service as qa_svc
import app.services.url_service as url_svc

router = APIRouter()


@router.post("/", response_model=QAResponse)
async def answer_question(
    request: QARequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Answer a question grounded in provided and previously visited page content."""
    user_id = current_user["user_id"]

    # Rate limiting
    rate_key = f"rate_limit:qa:{user_id}"
    count = await increment_rate_limit(rate_key, 60)
    if count > settings.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")

    if not request.chunks:
        raise HTTPException(status_code=400, detail="No content chunks provided")

    # Verify the chat belongs to this user
    if request.chat_id:
        chat = await chat_svc.get_chat(db, request.chat_id, user_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

    # Persist full_context for the current URL so it's available for future
    # comparative questions from this or other pages in the same chat
    if request.url and request.chunks:
        full_context = "\n\n".join(c.text for c in request.chunks)
        await url_svc.get_or_create(db, request.url, full_context)

    # Build the chunk list to send to the LLM.
    # For comparative questions, supplement with every other URL's full_context.
    chunks_to_use = list(request.chunks)
    if request.chat_id and qa_svc.is_comparative(request.question):
        extra = await qa_svc.get_all_chat_context(db, request.chat_id)
        # Prepend other pages; current page chunks go last (highest relevance)
        other = [c for c in extra if c.source_url != request.url]
        chunks_to_use = other + chunks_to_use

    # Build chat history from stored QA entries if not provided by client
    chat_history = request.chat_history
    if request.chat_id and not chat_history:
        messages = await qa_svc.get_chat_messages(db, request.chat_id)
        chat_history = [
            ChatMessage(role=m["role"], content=m["content"])
            for m in messages[-20:]
        ]

    llm_service = LLMService()
    try:
        result = await llm_service.answer_question(
            question=request.question,
            chunks=chunks_to_use,
            chat_history=chat_history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question answering failed: {str(e)}")

    response = QAResponse(
        answer=result["answer"],
        sources=result["sources"],
        confidence=result["confidence"],
        raw_llm_response=result.get("raw_llm_response"),
        response_time_ms=result["response_time_ms"],
    )

    # Persist the QA entry and bump the chat's updated_at
    if request.chat_id and request.url:
        await qa_svc.ensure_chat_url(db, request.chat_id, request.url)
        entry = QAEntry(
            question=request.question,
            answer=result["answer"],
            sources=[s.model_dump() for s in result["sources"]],
            type="qa",
        )
        await qa_svc.append_qa(db, request.chat_id, request.url, entry)
        await chat_svc.touch_chat(db, request.chat_id)

    return response
