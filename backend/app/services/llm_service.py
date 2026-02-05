"""
LLM service for Groq API integration
"""
import time
from typing import List, Dict, Any, Optional
from groq import AsyncGroq

from app.core.config import settings
from app.schemas.schemas import TextChunk, SourceReference, ChatMessage


class LLMService:
    """Service for LLM interactions using Groq"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize LLM service with Groq client"""
        self.api_key = api_key or settings.GROQ_API_KEY
        self.client = AsyncGroq(api_key=self.api_key)
        self.model = settings.GROQ_MODEL
    
    async def summarize(
        self,
        chunks: List[TextChunk],
        style: str = "short",
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate summary from text chunks"""
        start_time = time.time()
        
        # Prepare context from chunks
        content_text = self._prepare_context(chunks)
        
        # Create system prompt based on style
        system_prompt = self._get_summary_system_prompt(style)
        
        # Build user prompt
        user_prompt = f"Please summarize the following content:\n\n{content_text}"
        
        if context:
            user_prompt = f"{context}\n\n{user_prompt}"
        
        # Call Groq API
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=settings.GROQ_TEMPERATURE,
            max_tokens=settings.GROQ_MAX_TOKENS,
        )
        
        # Extract summary
        summary = response.choices[0].message.content
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Extract sources (simple heuristic - use first few chunks)
        sources = self._extract_sources(chunks[:3])
        
        return {
            "summary": summary,
            "sources": sources,
            "response_time_ms": response_time_ms,
            "tokens_used": response.usage.total_tokens if hasattr(response, 'usage') else 0,
        }
    
    async def answer_question(
        self,
        question: str,
        chunks: List[TextChunk],
        chat_history: Optional[List[ChatMessage]] = None,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Answer question based on text chunks"""
        start_time = time.time()
        
        # Prepare context from chunks
        content_text = self._prepare_context(chunks)
        
        # Create system prompt
        system_prompt = self._get_qa_system_prompt()
        
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
        ]
        
        # Add chat history if provided
        if chat_history:
            for msg in chat_history[-10:]:  # Last 10 messages
                messages.append({
                    "role": msg.role,
                    "content": msg.content,
                })
        
        # Add context
        if context:
            messages.append({
                "role": "system",
                "content": f"Additional context: {context}",
            })
        
        # Add current question with content
        user_message = (
            f"Content to reference:\n\n{content_text}\n\n"
            f"Question: {question}\n\n"
            f"Please answer the question based on the content provided. "
            f"Include specific references to support your answer."
        )
        messages.append({
            "role": "user",
            "content": user_message,
        })
        
        # Call Groq API
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=settings.GROQ_TEMPERATURE,
            max_tokens=settings.GROQ_MAX_TOKENS,
        )
        
        # Extract answer
        answer = response.choices[0].message.content
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Extract relevant sources
        sources = self._extract_relevant_sources(chunks, question, answer)
        
        return {
            "answer": answer,
            "sources": sources,
            "confidence": 0.85,  # Placeholder - could be enhanced
            "response_time_ms": response_time_ms,
            "tokens_used": response.usage.total_tokens if hasattr(response, 'usage') else 0,
            "raw_llm_response": answer,
        }
    
    async def compare_pages(
        self,
        question: str,
        page_chunks_list: List[List[TextChunk]],
        page_urls: List[str],
    ) -> Dict[str, Any]:
        """Compare multiple pages and answer questions"""
        start_time = time.time()
        
        # Prepare context from multiple pages
        contexts = []
        for i, chunks in enumerate(page_chunks_list):
            page_text = self._prepare_context(chunks)
            contexts.append(f"Page {i+1} ({page_urls[i]}):\n{page_text[:2000]}")  # Limit each page
        
        combined_context = "\n\n---\n\n".join(contexts)
        
        # Create system prompt for comparison
        system_prompt = (
            "You are an AI assistant that analyzes and compares multiple web pages. "
            "Provide clear, factual comparisons with specific references to each page. "
            "When highlighting differences or similarities, cite which page each point comes from."
        )
        
        # Build user prompt
        user_prompt = (
            f"I have {len(page_urls)} pages to analyze:\n\n"
            f"{combined_context}\n\n"
            f"Question: {question}\n\n"
            f"Please analyze and compare these pages to answer the question."
        )
        
        # Call Groq API
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=settings.GROQ_TEMPERATURE,
            max_tokens=min(settings.GROQ_MAX_TOKENS * 2, 2048),  # Allow longer response
        )
        
        answer = response.choices[0].message.content
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Collect sources from all pages
        all_sources = []
        for chunks in page_chunks_list:
            all_sources.extend(self._extract_sources(chunks[:2]))
        
        return {
            "answer": answer,
            "sources": all_sources,
            "pages_analyzed": page_urls,
            "response_time_ms": response_time_ms,
        }
    
    def _prepare_context(self, chunks: List[TextChunk], max_chars: int = 8000) -> str:
        """Prepare context from chunks"""
        context_parts = []
        total_chars = 0
        
        for chunk in chunks:
            if total_chars + len(chunk.text) > max_chars:
                break
            context_parts.append(chunk.text)
            total_chars += len(chunk.text)
        
        return "\n\n".join(context_parts)
    
    def _get_summary_system_prompt(self, style: str) -> str:
        """Get system prompt for summarization"""
        prompts = {
            "short": (
                "You are a concise summarization assistant. Create brief, "
                "accurate summaries in 2-3 sentences that capture the main points."
            ),
            "long": (
                "You are a detailed summarization assistant. Create comprehensive "
                "summaries that cover all key points, important details, and main arguments."
            ),
            "bullet": (
                "You are a bullet-point summarization assistant. Create clear, "
                "organized bullet-point summaries that highlight key information."
            ),
        }
        return prompts.get(style, prompts["short"])
    
    def _get_qa_system_prompt(self) -> str:
        """Get system prompt for Q&A"""
        return (
            "You are a helpful AI assistant that answers questions based on provided content. "
            "Always base your answers on the given content. If the content doesn't contain "
            "enough information to answer the question, say so clearly. "
            "Provide specific references when possible."
        )
    
    def _extract_sources(self, chunks: List[TextChunk]) -> List[SourceReference]:
        """Extract source references from chunks"""
        sources = []
        for chunk in chunks:
            sources.append(SourceReference(
                chunk_id=chunk.id,
                score=0.9,  # Placeholder
                selector=chunk.dom_selector,
                text=chunk.text[:200] + "..." if len(chunk.text) > 200 else chunk.text,
            ))
        return sources
    
    def _extract_relevant_sources(
        self,
        chunks: List[TextChunk],
        question: str,
        answer: str,
    ) -> List[SourceReference]:
        """Extract relevant sources based on question and answer"""
        # Simple heuristic: take first 3 chunks
        # Could be enhanced with semantic similarity
        return self._extract_sources(chunks[:3])