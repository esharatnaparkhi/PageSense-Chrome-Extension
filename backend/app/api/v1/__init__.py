"""
API v1 router
"""
from fastapi import APIRouter

from app.api.v1 import auth, extract, summarize, qa, chat, embed

router = APIRouter()

# Include sub-routers
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(extract.router, prefix="/extract", tags=["Content Extraction"])
router.include_router(summarize.router, prefix="/summarize", tags=["Summarization"])
router.include_router(qa.router, prefix="/qa", tags=["Question & Answer"])
router.include_router(chat.router, prefix="/chat", tags=["Chat Management"])
router.include_router(embed.router, prefix="/embed", tags=["Embeddings & RAG"])