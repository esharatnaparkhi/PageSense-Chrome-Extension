"""
Pydantic document models for MongoDB collections.

Collections
-----------
users      – registered users
chats      – chat sessions (≤ 3 per user)
chat_urls  – emulates chats/{chatId}/urls/{urlId} subcollection
urls       – global URL store (full & summarised context)
"""
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.utcnow()


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------

class UserDocument(BaseModel):
    """Stored in `users` collection.  _id is a MongoDB ObjectId (string on read)."""
    email: str
    hashed_password: str = ""          # empty for Google-only accounts
    is_active: bool = True
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# chats
# ---------------------------------------------------------------------------

class ChatDocument(BaseModel):
    """Stored in `chats` collection."""
    user_id: str                        # string repr of user's _id
    title: str = "New Chat"
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# chat_urls  (chats/{chatId}/urls/{urlId} emulated as a flat collection)
# ---------------------------------------------------------------------------

class QAEntry(BaseModel):
    """Single Q&A turn (or summary) stored inside chat_urls.qa[].

    For summaries, `question` is an empty string and `type` is "summary".
    """
    question: str
    answer: str
    sources: List[Any] = Field(default_factory=list)
    type: str = "qa"                    # "qa" | "summary"
    created_at: datetime = Field(default_factory=_now)


class ChatUrlDocument(BaseModel):
    """Stored in `chat_urls` collection.
    Compound unique index on (chat_id, url_id) enforced at DB level.
    """
    chat_id: str                        # string repr of chat's _id
    url_id: str                         # sha256 hash of the URL (24 hex chars)
    url: str                            # the full URL
    qa: List[QAEntry] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# urls  (global URL store)
# ---------------------------------------------------------------------------

class UrlDocument(BaseModel):
    """Stored in `urls` collection.
    _id == url_id (string) — guarantees no duplicate URL documents.
    """
    url: str
    full_context: str                   # concatenated chunk texts
    summarised_context: Optional[str] = None
    summarising: bool = False           # optimistic lock flag
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
