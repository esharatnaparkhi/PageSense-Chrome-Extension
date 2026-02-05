"""
Chat management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import (
    ChatCreate,
    ChatResponse,
    ChatHistoryResponse,
    MessageResponse,
)
from app.models.models import Chat, Message
from app.core.config import settings

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat_data: ChatCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat session"""
    user_id = int(current_user["user_id"])
    
    # Check chat limit (max 3 per user)
    chat_count = await db.scalar(
        select(func.count(Chat.id)).where(Chat.user_id == user_id)
    )
    
    if chat_count >= settings.MAX_CHATS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {settings.MAX_CHATS_PER_USER} chats allowed per user. Please delete an existing chat first."
        )
    
    # Create new chat
    new_chat = Chat(
        user_id=user_id,
        title=chat_data.title or "New Chat",
        context={},
    )
    
    db.add(new_chat)
    await db.commit()
    await db.refresh(new_chat)
    
    return ChatResponse(
        id=new_chat.id,
        user_id=new_chat.user_id,
        title=new_chat.title,
        created_at=new_chat.created_at,
        updated_at=new_chat.updated_at,
        message_count=0,
    )


@router.get("/", response_model=List[ChatResponse])
async def list_chats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all chats for current user"""
    user_id = int(current_user["user_id"])
    
    # Get all chats with message counts
    result = await db.execute(
        select(Chat)
        .where(Chat.user_id == user_id)
        .order_by(Chat.updated_at.desc())
    )
    chats = result.scalars().all()
    
    # Get message counts
    chat_responses = []
    for chat in chats:
        message_count = await db.scalar(
            select(func.count(Message.id)).where(Message.chat_id == chat.id)
        )
        
        chat_responses.append(ChatResponse(
            id=chat.id,
            user_id=chat.user_id,
            title=chat.title,
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            message_count=message_count or 0,
        ))
    
    return chat_responses


@router.get("/{chat_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    chat_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get chat history with messages"""
    user_id = int(current_user["user_id"])
    
    # Get chat
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Get messages
    messages_result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
    )
    messages = messages_result.scalars().all()
    
    # Get message count
    message_count = len(messages)
    
    return ChatHistoryResponse(
        chat=ChatResponse(
            id=chat.id,
            user_id=chat.user_id,
            title=chat.title,
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            message_count=message_count,
        ),
        messages=[
            MessageResponse(
                id=msg.id,
                chat_id=msg.chat_id,
                role=msg.role,
                content=msg.content,
                extra_data=msg.extra_data,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
    )


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat and all its messages"""
    user_id = int(current_user["user_id"])
    
    # Get chat
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Delete chat (cascade will delete messages)
    await db.delete(chat)
    await db.commit()
    
    return {"message": "Chat deleted successfully"}


@router.put("/{chat_id}/title")
async def update_chat_title(
    chat_id: int,
    chat_data: ChatCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update chat title"""
    user_id = int(current_user["user_id"])
    
    # Get chat
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Update title
    chat.title = chat_data.title or chat.title
    await db.commit()
    
    return {"message": "Chat title updated successfully"}