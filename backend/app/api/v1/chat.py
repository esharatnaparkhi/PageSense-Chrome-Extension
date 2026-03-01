"""
Chat management endpoints (MongoDB version)
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import (
    ChatCreate,
    ChatResponse,
    ChatHistoryResponse,
    MessageResponse,
)
import app.services.chat_service as chat_svc
import app.services.qa_service as qa_svc

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat_data: ChatCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a new chat session (max 3 per user)."""
    user_id = current_user["user_id"]
    chat = await chat_svc.create_chat(db, user_id, title=chat_data.title or "New Chat")
    return ChatResponse(
        id=chat["id"],
        user_id=chat["user_id"],
        title=chat["title"],
        created_at=chat["created_at"],
        updated_at=chat["updated_at"],
        message_count=0,
    )


@router.get("/", response_model=List[ChatResponse])
async def list_chats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all chats for the current user (newest first)."""
    user_id = current_user["user_id"]
    chats = await chat_svc.list_chats(db, user_id)
    return [
        ChatResponse(
            id=c["id"],
            user_id=c["user_id"],
            title=c["title"],
            created_at=c["created_at"],
            updated_at=c["updated_at"],
            message_count=c.get("message_count", 0),
        )
        for c in chats
    ]


@router.get("/{chat_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    chat_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get a chat with its full message history."""
    user_id = current_user["user_id"]
    chat = await chat_svc.get_chat(db, chat_id, user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = await qa_svc.get_chat_messages(db, chat_id)
    return ChatHistoryResponse(
        chat=ChatResponse(
            id=chat["id"],
            user_id=chat["user_id"],
            title=chat["title"],
            created_at=chat["created_at"],
            updated_at=chat["updated_at"],
            message_count=len(messages) // 2,
        ),
        messages=[
            MessageResponse(
                role=m["role"],
                content=m["content"],
                extra_data=m.get("extra_data", {}),
                url=m.get("url"),
                page_title=m.get("page_title"),
                created_at=m.get("created_at"),
            )
            for m in messages
        ],
    )


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete a chat and all its associated data."""
    user_id = current_user["user_id"]
    deleted = await chat_svc.delete_chat(db, chat_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"message": "Chat deleted successfully"}


@router.put("/{chat_id}/title")
async def update_chat_title(
    chat_id: str,
    chat_data: ChatCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update the title of a chat."""
    user_id = current_user["user_id"]
    updated = await chat_svc.update_chat_title(
        db, chat_id, user_id, chat_data.title or "New Chat"
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"message": "Chat title updated successfully"}


@router.post("/{chat_id}/page-visit")
async def record_page_visit(
    chat_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Register a URL as visited in a chat (creates the chat_url slot)."""
    user_id = current_user["user_id"]
    chat = await chat_svc.get_chat(db, chat_id, user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    url = body.get("url", "")
    if url:
        await qa_svc.ensure_chat_url(db, chat_id, url)
    return {"ok": True}


@router.get("/{chat_id}/page-visits")
async def get_page_visits(
    chat_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all URLs visited in a chat."""
    user_id = current_user["user_id"]
    chat = await chat_svc.get_chat(db, chat_id, user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    chat_urls = await db.chat_urls.find({"chat_id": chat_id}).to_list(None)
    return [{"url": cu["url"], "visited_at": cu["created_at"]} for cu in chat_urls]
