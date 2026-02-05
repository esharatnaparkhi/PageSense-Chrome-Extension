"""
Question & Answer endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.redis_client import increment_rate_limit
from app.schemas.schemas import (
    QARequest,
    QAResponse,
    MultiPageRequest,
    MultiPageResponse,
)
from app.services.llm_service import LLMService
from app.services.content_extractor import ContentExtractor
from app.models.models import User, Chat, Message
from app.core.config import settings
import httpx

router = APIRouter()
def get_extractor():
    return ContentExtractor()


@router.post("/", response_model=QAResponse)
async def answer_question(
    request: QARequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Answer question based on page content"""
    user_id = int(current_user["user_id"])
    
    # Rate limiting
    rate_key = f"rate_limit:qa:{user_id}"
    count = await increment_rate_limit(rate_key, 60)
    if count > settings.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )
    
    # Validate input
    if not request.chunks:
        raise HTTPException(
            status_code=400,
            detail="No content chunks provided"
        )
    
    # Get user's API key if provided
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    api_key = user.groq_api_key if user else None
    
    # Initialize LLM service
    llm_service = LLMService(api_key=api_key)
    
    # Get chat context if chat_id provided
    context = None
    chat_history = request.chat_history
    
    if request.chat_id:
        chat_result = await db.execute(
            select(Chat).where(Chat.id == request.chat_id, Chat.user_id == user_id)
        )
        chat = chat_result.scalar_one_or_none()
        
        if chat:
            # Get recent messages for context
            messages_result = await db.execute(
                select(Message)
                .where(Message.chat_id == chat.id)
                .order_by(Message.created_at.desc())
                .limit(10)
            )
            messages = list(reversed(messages_result.scalars().all()))
            
            from app.schemas.schemas import ChatMessage
            chat_history = [
                ChatMessage(role=msg.role, content=msg.content)
                for msg in messages
            ]
            
            context = chat.context.get("summary", "")
    
    # Answer question
    try:
        result = await llm_service.answer_question(
            question=request.question,
            chunks=request.chunks,
            chat_history=chat_history,
            context=context,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Question answering failed: {str(e)}"
        )
    
    # Prepare response
    response = QAResponse(
        answer=result["answer"],
        sources=result["sources"],
        confidence=result["confidence"],
        raw_llm_response=result.get("raw_llm_response"),
        response_time_ms=result["response_time_ms"],
    )
    
    # Save to chat if chat_id provided
    if request.chat_id:
        chat_result = await db.execute(
            select(Chat).where(Chat.id == request.chat_id, Chat.user_id == user_id)
        )
        chat = chat_result.scalar_one_or_none()
        
        if chat:
            # Check message limit
            message_count = await db.scalar(
                select(func.count(Message.id)).where(Message.chat_id == chat.id)
            )
            
            if message_count >= settings.MAX_MESSAGES_PER_CHAT:
                raise HTTPException(
                    status_code=400,
                    detail=f"Chat has reached maximum of {settings.MAX_MESSAGES_PER_CHAT} messages"
                )
            
            # Add user question
            user_msg = Message(
                chat_id=chat.id,
                role="user",
                content=request.question,
                extra_data={},
            )
            db.add(user_msg)
            
            # Add assistant answer
            assistant_msg = Message(
                chat_id=chat.id,
                role="assistant",
                content=result["answer"],
                extra_data={
                    "sources": [s.model_dump() for s in result["sources"]],
                    "confidence": result["confidence"],
                },
            )
            db.add(assistant_msg)
            
            await db.commit()
    
    return response


@router.post("/multi-page", response_model=MultiPageResponse)
async def answer_multipage_question(
    request: MultiPageRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    extractor: ContentExtractor = Depends(get_extractor),
):
    """Answer question comparing multiple pages"""
    user_id = int(current_user["user_id"])
    
    # Rate limiting
    rate_key = f"rate_limit:qa:{user_id}"
    count = await increment_rate_limit(rate_key, 60)
    if count > settings.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )
    
    # Validate input
    if not request.urls or len(request.urls) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 page URLs are required for comparison"
        )
    
    if len(request.urls) > 5:
        raise HTTPException(
            status_code=400,
            detail="Maximum 5 pages can be compared at once"
        )
    
    # Fetch and extract content from all URLs
    page_chunks_list = []
    
    for url in request.urls:
        try:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                )
            }
            # Fetch HTML
            async with httpx.AsyncClient(headers=headers,follow_redirects=True,timeout=15.0) as client:
                response = await client.get(url, timeout=10.0)
                response.raise_for_status()
                html = response.text
            
            # Extract content
            result = extractor.extract_from_html(html=html, url=url)
            page_chunks_list.append(result['chunks'])
            
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch/extract content from {url}: {str(e)}"
            )
    
    # Get user's API key
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    api_key = user.groq_api_key if user else None
    
    # Initialize LLM service
    llm_service = LLMService(api_key=api_key)
    
    # Compare pages
    try:
        result = await llm_service.compare_pages(
            question=request.question,
            page_chunks_list=page_chunks_list,
            page_urls=request.urls,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Multi-page comparison failed: {str(e)}"
        )
    
    # Prepare response
    response = MultiPageResponse(
        answer=result["answer"],
        sources=result["sources"],
        pages_analyzed=result["pages_analyzed"],
        response_time_ms=result["response_time_ms"],
    )
    
    # Save to chat if chat_id provided
    if request.chat_id:
        chat_result = await db.execute(
            select(Chat).where(Chat.id == request.chat_id, Chat.user_id == user_id)
        )
        chat = chat_result.scalar_one_or_none()
        
        if chat:
            # Add user question
            user_msg = Message(
                chat_id=chat.id,
                role="user",
                content=request.question,
                extra_data={"pages": request.urls, "type": "multi_page"},
            )
            db.add(user_msg)
            
            # Add assistant answer
            assistant_msg = Message(
                chat_id=chat.id,
                role="assistant",
                content=result["answer"],
                extra_data={
                    "sources": [s.model_dump() for s in result["sources"]],
                    "pages_analyzed": result["pages_analyzed"],
                    "type": "multi_page",
                },
            )
            db.add(assistant_msg)
            
            await db.commit()
    
    return response