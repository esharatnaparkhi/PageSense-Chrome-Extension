"""
Embeddings and RAG endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import EmbedRequest, EmbedResponse, TextChunk
from app.services.vector_store import VectorStoreService

router = APIRouter()
def get_vector_store():
    return VectorStoreService()


@router.post("/", response_model=EmbedResponse)
async def embed_document(
    request: EmbedRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    vector_store: VectorStoreService = Depends(get_vector_store),
):
    """Embed document and store in vector database"""
    user_id = int(current_user["user_id"])
    
    # Initialize collection if needed
    await vector_store.initialize_collection()
    
    # Create a text chunk
    chunk = TextChunk(
        id=request.doc_id,
        text=request.text,
        start_char=0,
        end_char=len(request.text),
        dom_selector=None,
    )
    
    # Add to vector store
    try:
        vector_ids = await vector_store.add_chunks(
            chunks=[chunk],
            page_id=0,  # Standalone document
            user_id=user_id,
        )
        
        return EmbedResponse(
            doc_id=request.doc_id,
            vector_id=vector_ids[0],
            success=True,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding failed: {str(e)}"
        )


@router.get("/health")
async def embeddings_health(vector_store: VectorStoreService = Depends(get_vector_store)):
    """Check embeddings service health"""
    try:
        await vector_store.initialize_collection()
        return {"status": "healthy", "service": "embeddings"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Embeddings service unavailable: {str(e)}"
        )