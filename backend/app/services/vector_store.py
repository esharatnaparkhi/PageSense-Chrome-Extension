"""
Vector store service using Qdrant for RAG
"""
from typing import List, Optional
import hashlib
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

from app.core.config import settings
from app.schemas.schemas import TextChunk


class VectorStoreService:
    """Service for vector embeddings and similarity search"""
    
    def __init__(self):
        """Initialize vector store service"""
        self.client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
        )
        self.collection_name = settings.QDRANT_COLLECTION_NAME
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        self.embedding_dimension = settings.EMBEDDING_DIMENSION
    
    async def initialize_collection(self):
        """Create collection if it doesn't exist"""
        collections = await self.client.get_collections()
        collection_names = [c.name for c in collections.collections]
        
        if self.collection_name not in collection_names:
            await self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.embedding_dimension,
                    distance=Distance.COSINE,
                ),
            )
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for text"""
        embedding = self.embedding_model.encode(text)
        return embedding.tolist()
    
    async def add_chunks(
        self,
        chunks: List[TextChunk],
        page_id: int,
        user_id: int,
    ) -> List[str]:
        """Add text chunks to vector store"""
        points = []
        vector_ids = []
        
        for chunk in chunks:
            # Generate embedding
            embedding = self.embed_text(chunk.text)
            
            # Create unique vector ID
            vector_id = hashlib.md5(
                f"{user_id}:{page_id}:{chunk.id}".encode()
            ).hexdigest()
            
            # Create point
            point = PointStruct(
                id=vector_id,
                vector=embedding,
                payload={
                    "chunk_id": chunk.id,
                    "page_id": page_id,
                    "user_id": user_id,
                    "text": chunk.text,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                    "dom_selector": chunk.dom_selector,
                },
            )
            
            points.append(point)
            vector_ids.append(vector_id)
        
        # Upload points
        if points:
            await self.client.upsert(
                collection_name=self.collection_name,
                points=points,
            )
        
        return vector_ids
    
    async def search(
        self,
        query: str,
        user_id: int,
        limit: int = 5,
        page_id: Optional[int] = None,
    ) -> List[dict]:
        """Search for similar chunks"""
        # Generate query embedding
        query_embedding = self.embed_text(query)
        
        # Build filter
        search_filter = {
            "must": [
                {"key": "user_id", "match": {"value": user_id}}
            ]
        }
        
        if page_id:
            search_filter["must"].append(
                {"key": "page_id", "match": {"value": page_id}}
            )
        
        # Search
        results = await self.client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding,
            query_filter=search_filter,
            limit=limit,
        )
        
        # Format results
        formatted_results = []
        for result in results:
            formatted_results.append({
                "chunk_id": result.payload.get("chunk_id"),
                "text": result.payload.get("text"),
                "score": result.score,
                "page_id": result.payload.get("page_id"),
                "start_char": result.payload.get("start_char"),
                "end_char": result.payload.get("end_char"),
                "dom_selector": result.payload.get("dom_selector"),
            })
        
        return formatted_results
    
    async def delete_page_vectors(self, page_id: int, user_id: int):
        """Delete all vectors for a page"""
        await self.client.delete(
            collection_name=self.collection_name,
            points_selector={
                "filter": {
                    "must": [
                        {"key": "page_id", "match": {"value": page_id}},
                        {"key": "user_id", "match": {"value": user_id}},
                    ]
                }
            },
        )
    
    async def delete_user_vectors(self, user_id: int):
        """Delete all vectors for a user"""
        await self.client.delete(
            collection_name=self.collection_name,
            points_selector={
                "filter": {
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}},
                    ]
                }
            },
        )