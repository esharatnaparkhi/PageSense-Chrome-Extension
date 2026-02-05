"""
Summarization endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.redis_client import get_cache, set_cache, increment_rate_limit
from app.schemas.schemas import SummarizeRequest, SummarizeResponse
from app.services.llm_service import LLMService
from app.models.models import User, Chat, Message
from app.core.config import settings
import hashlib

router = APIRouter()


@router.post("/", response_model=SummarizeResponse)
async def summarize_content(
    request: SummarizeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Summarize web page content"""
    user_id = int(current_user["user_id"])
    
    # Rate limiting
    rate_key = f"rate_limit:summarize:{user_id}"
    count = await increment_rate_limit(rate_key, 60)
    if count > settings.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )
    
    # Validate chunks
    if not request.chunks:
        raise HTTPException(
            status_code=400,
            detail="No content chunks provided"
        )
    
    # Check cache
    chunk_hash = hashlib.md5("".join([c.text for c in request.chunks]).encode()).hexdigest()

    cache_key = hashlib.md5(
        f"summary:{user_id}:{chunk_hash}:{request.summary_style}".encode()).hexdigest()

    cached_result = await get_cache(cache_key)
    if cached_result:
        return SummarizeResponse(**cached_result)
    
    # Get user's API key if provided
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    api_key = user.groq_api_key if user else None
    
    # Initialize LLM service
    llm_service = LLMService(api_key=api_key)
    
    # Get chat context if chat_id provided
    context = None
    if request.chat_id:
        chat_result = await db.execute(
            select(Chat).where(Chat.id == request.chat_id, Chat.user_id == user_id)
        )
        chat = chat_result.scalar_one_or_none()
        if chat:
            context = None
    
    # Generate summary
    try:
        result = await llm_service.summarize(
            chunks=request.chunks,
            style=request.summary_style,
            context=context,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Summarization failed: {str(e)}"
        )
    
    # Prepare response
    response = SummarizeResponse(
        summary=result["summary"],
        sources=result["sources"],
        cost_estimate=0.001,  # Placeholder
        response_time_ms=result["response_time_ms"],
    )
    
    # Cache result
    await set_cache(cache_key, response.model_dump())
    
    # Save to chat if chat_id provided
    if request.chat_id:
        chat_result = await db.execute(
            select(Chat).where(Chat.id == request.chat_id, Chat.user_id == user_id)
        )
        chat = chat_result.scalar_one_or_none()
        
        if chat:
            # Check message limit
            from sqlalchemy import func

            message_count = await db.scalar(
                select(func.count(Message.id))
                .where(Message.chat_id == chat.id)
            )
            
            if message_count >= settings.MAX_MESSAGES_PER_CHAT:
                raise HTTPException(
                    status_code=400,
                    detail=f"Chat has reached maximum of {settings.MAX_MESSAGES_PER_CHAT} messages"
                )
            
            # Add system message with summary
            summary_msg = Message(
                chat_id=chat.id,
                role="assistant",
                content=result["summary"],
                extra_data={"type": "summary", "sources": [s.model_dump() for s in result["sources"]]},
            )
            db.add(summary_msg)
            await db.commit()
    
    return response