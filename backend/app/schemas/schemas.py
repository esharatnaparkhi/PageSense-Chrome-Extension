"""
Pydantic schemas for request/response validation
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================================================
# Authentication Schemas
# ============================================================================

class UserCreate(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    created_at: datetime


# ============================================================================
# Content Extraction Schemas
# ============================================================================

class TextChunk(BaseModel):
    id: str
    text: str
    start_char: int
    end_char: int
    dom_selector: Optional[str] = None


class ExtractRequest(BaseModel):
    url: str
    html: Optional[str] = None
    include_images: bool = False


class ExtractResponse(BaseModel):
    text_chunks: List[TextChunk]
    meta: Dict[str, Any]
    url: str
    title: Optional[str] = None


# ============================================================================
# Summarization Schemas
# ============================================================================

class SummarizeRequest(BaseModel):
    page_id: Optional[int] = None
    url: Optional[str] = None
    chunks: Optional[List[TextChunk]] = None
    summary_style: str = Field(default="short", pattern="^(short|long|bullet)$")
    max_tokens: int = Field(default=512, ge=50, le=2048)
    chat_id: Optional[int] = None


class SourceReference(BaseModel):
    chunk_id: str
    score: float
    selector: Optional[str] = None
    text: str


class SummarizeResponse(BaseModel):
    summary: str
    sources: List[SourceReference]
    cost_estimate: float
    response_time_ms: int


# ============================================================================
# Q&A Schemas
# ============================================================================

class ChatMessage(BaseModel):
    role: str
    content: str


class QARequest(BaseModel):
    question: str
    page_id: Optional[int] = None
    url: Optional[str] = None
    chunks: Optional[List[TextChunk]] = None
    chat_id: Optional[int] = None
    chat_history: Optional[List[ChatMessage]] = None


class QAResponse(BaseModel):
    answer: str
    sources: List[SourceReference]
    confidence: float
    raw_llm_response: Optional[str] = None
    response_time_ms: int


# ============================================================================
# Chat Management Schemas
# ============================================================================

class ChatCreate(BaseModel):
    title: Optional[str] = None


class ChatResponse(BaseModel):
    id: int
    user_id: int
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: int


class MessageResponse(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    extra_data: Dict[str, Any]
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    chat: ChatResponse
    messages: List[MessageResponse]


# ============================================================================
# Embedding and RAG Schemas
# ============================================================================

class EmbedRequest(BaseModel):
    doc_id: str
    text: str


class EmbedResponse(BaseModel):
    doc_id: str
    vector_id: str
    success: bool


# ============================================================================
# Multi-Page Comparison Schemas
# ============================================================================

class MultiPageRequest(BaseModel):
    """Request for comparing or analyzing multiple pages"""
    question: str
    page_ids: Optional[List[int]] = None
    urls: Optional[List[str]] = None
    chat_id: Optional[int] = None


class MultiPageResponse(BaseModel):
    """Response for multi-page analysis"""
    answer: str
    sources: List[SourceReference]
    pages_analyzed: List[str]
    response_time_ms: int


# ============================================================================
# Error Response Schema
# ============================================================================

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None