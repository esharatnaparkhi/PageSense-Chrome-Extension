"""
LLM service — OpenAI API integration
"""
import time
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas.schemas import TextChunk, SourceReference, ChatMessage


class LLMService:
    """Service for LLM interactions using OpenAI"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.client = AsyncOpenAI(api_key=self.api_key)
        self.model = settings.OPENAI_MODEL

    # -------------------------------------------------------------------------
    # PUBLIC METHODS
    # -------------------------------------------------------------------------

    async def summarize(
        self,
        chunks: List[TextChunk],
        style: str = "short",
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a structured summary from page content chunks."""
        start_time = time.time()

        content_text = self._prepare_context(chunks)
        system_prompt = self._get_summary_system_prompt(style)
        user_prompt = (
            f"Here is the full page content to summarize:\n\n"
            f"---\n{content_text}\n---\n\n"
            f"Produce the summary now."
        )
        if context:
            user_prompt = f"Prior context from this session:\n{context}\n\n{user_prompt}"

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=settings.OPENAI_TEMPERATURE,
            max_tokens=settings.OPENAI_MAX_TOKENS,
        )

        summary = response.choices[0].message.content
        response_time_ms = int((time.time() - start_time) * 1000)
        sources = self._extract_sources(chunks[:3])

        return {
            "summary": summary,
            "sources": sources,
            "response_time_ms": response_time_ms,
            "tokens_used": response.usage.total_tokens if response.usage else 0,
        }

    async def answer_question(
        self,
        question: str,
        chunks: List[TextChunk],
        chat_history: Optional[List[ChatMessage]] = None,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Answer a user question grounded in the provided page content."""
        start_time = time.time()

        content_text = self._prepare_context(chunks)
        system_prompt = self._get_qa_system_prompt()

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt},
        ]

        if context:
            messages.append({
                "role": "system",
                "content": f"Additional session context:\n{context}",
            })

        # Include recent chat history (last 10 turns) for conversational continuity
        if chat_history:
            for msg in chat_history[-10:]:
                messages.append({"role": msg.role, "content": msg.content})

        messages.append({
            "role": "user",
            "content": (
                f"PAGE CONTENT:\n---\n{content_text}\n---\n\n"
                f"USER QUESTION: {question}\n\n"
                f"Answer the question using only the page content above. "
                f"If the content does not contain sufficient information, "
                f"say so explicitly and indicate what is missing."
            ),
        })

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=settings.OPENAI_TEMPERATURE,
            max_tokens=settings.OPENAI_MAX_TOKENS,
        )

        answer = response.choices[0].message.content
        response_time_ms = int((time.time() - start_time) * 1000)
        sources = self._extract_relevant_sources(chunks, question, answer)

        return {
            "answer": answer,
            "sources": sources,
            "confidence": 0.9,
            "response_time_ms": response_time_ms,
            "tokens_used": response.usage.total_tokens if response.usage else 0,
            "raw_llm_response": answer,
        }

    async def compare_pages(
        self,
        question: str,
        page_chunks_list: List[List[TextChunk]],
        page_urls: List[str],
    ) -> Dict[str, Any]:
        """Compare multiple pages and answer a cross-page question."""
        start_time = time.time()

        page_sections = []
        for i, chunks in enumerate(page_chunks_list):
            text = self._prepare_context(chunks, max_chars=3000)
            page_sections.append(
                f"### Page {i + 1}: {page_urls[i]}\n{text}"
            )
        combined = "\n\n---\n\n".join(page_sections)

        system_prompt = self._get_compare_system_prompt()
        user_prompt = (
            f"I have {len(page_urls)} pages for you to analyse:\n\n"
            f"{combined}\n\n"
            f"USER QUESTION: {question}\n\n"
            f"Answer the question by comparing the relevant content across all pages. "
            f"Clearly label information by page number (e.g. 'Page 1 states…')."
        )

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=settings.OPENAI_TEMPERATURE,
            max_tokens=min(settings.OPENAI_MAX_TOKENS * 2, 2048),
        )

        answer = response.choices[0].message.content
        response_time_ms = int((time.time() - start_time) * 1000)

        all_sources: List[SourceReference] = []
        for chunks in page_chunks_list:
            all_sources.extend(self._extract_sources(chunks[:2]))

        return {
            "answer": answer,
            "sources": all_sources,
            "pages_analyzed": page_urls,
            "response_time_ms": response_time_ms,
        }

    # -------------------------------------------------------------------------
    # PROMPTS
    # -------------------------------------------------------------------------

    def _get_summary_system_prompt(self, style: str) -> str:
        base = (
            "You are PageSense, an AI reading assistant embedded in a browser extension. "
            "Your job is to help users quickly understand web pages they are visiting. "
            "Never invent information — base your output solely on the content provided. "
            "Do not add filler phrases like 'This article discusses…' or 'In conclusion…'. "
            "Be direct, precise, and informative.\n\n"
        )
        styles = {
            "short": (
                base
                + "TASK: Write a concise summary in 2–4 sentences.\n"
                + "Cover: (1) the main topic, (2) the key finding or argument, "
                + "(3) any important conclusion or call to action.\n"
                + "Tone: neutral, factual, no filler."
            ),
            "long": (
                base
                + "TASK: Write a thorough, multi-paragraph summary.\n"
                + "Structure:\n"
                + "  • Paragraph 1 — Main topic and purpose of the page\n"
                + "  • Paragraph 2 — Key arguments, findings, or information\n"
                + "  • Paragraph 3 — Supporting details, data, or examples\n"
                + "  • Paragraph 4 — Conclusions, recommendations, or next steps (if present)\n"
                + "Tone: neutral, detailed, no padding."
            ),
            "bullet": (
                base
                + "TASK: Extract the most important information as a bullet-point list.\n"
                + "Rules:\n"
                + "  • Each bullet must be a self-contained, specific insight (not vague)\n"
                + "  • Include concrete numbers, names, or dates where present\n"
                + "  • Use sub-bullets under a short heading if topics are distinct\n"
                + "  • Aim for 5–10 bullets — cut anything that isn't genuinely useful"
            ),
        }
        return styles.get(style, styles["short"])

    def _get_qa_system_prompt(self) -> str:
        return (
            "You are PageSense, an AI assistant embedded in a browser extension. "
            "You help users understand and extract information from web pages they are viewing.\n\n"
            "CAPABILITIES:\n"
            "  • Answer questions about the specific page content provided\n"
            "  • Reference and quote exact passages when they support your answer\n"
            "  • Compare information across multiple pages when content from several pages is included\n"
            "  • Acknowledge gaps: if the content does not answer the question, say so clearly\n\n"
            "RULES:\n"
            "  1. Ground every answer strictly in the provided PAGE CONTENT — do not hallucinate\n"
            "  2. Quote or paraphrase specific sections to justify your answer\n"
            "  3. If the answer is not in the content, respond: "
            "\"The page doesn't contain information about [topic]. "
            "Here is what I found that may be related: …\"\n"
            "  4. Keep answers focused and concise — avoid padding or repetition\n"
            "  5. When multiple pages are provided, label which page each piece of information comes from"
        )

    def _get_compare_system_prompt(self) -> str:
        return (
            "You are PageSense, an AI assistant specialised in comparing and contrasting web pages.\n\n"
            "TASK: Answer the user's question by analysing the provided pages side by side.\n\n"
            "RULES:\n"
            "  1. Always label information by its source page (e.g. 'Page 1 states…', 'Page 2 argues…')\n"
            "  2. Highlight specific similarities and differences with direct quotes or paraphrases\n"
            "  3. Use a structured format (e.g. comparison table or labelled bullet list) when helpful\n"
            "  4. Be factual and objective — do not inject personal opinion\n"
            "  5. If a question cannot be answered from the available content, say so explicitly\n"
            "  6. Do not invent information not present in the provided page content"
        )

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _prepare_context(self, chunks: List[TextChunk], max_chars: int = 8000) -> str:
        parts = []
        total = 0
        for chunk in chunks:
            if total + len(chunk.text) > max_chars:
                break
            parts.append(chunk.text)
            total += len(chunk.text)
        return "\n\n".join(parts)

    def _extract_sources(self, chunks: List[TextChunk]) -> List[SourceReference]:
        return [
            SourceReference(
                chunk_id=chunk.id,
                score=0.9,
                selector=chunk.dom_selector,
                text=chunk.text[:200] + "…" if len(chunk.text) > 200 else chunk.text,
            )
            for chunk in chunks
        ]

    def _extract_relevant_sources(
        self,
        chunks: List[TextChunk],
        question: str,
        answer: str,
    ) -> List[SourceReference]:
        """Return chunks whose text overlaps with key words in the answer."""
        answer_words = set(answer.lower().split())
        scored = []
        for chunk in chunks:
            chunk_words = set(chunk.text.lower().split())
            overlap = len(answer_words & chunk_words)
            scored.append((overlap, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_chunks = [c for _, c in scored[:3]]
        return self._extract_sources(top_chunks)
