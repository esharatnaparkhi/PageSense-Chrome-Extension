# PageSense

PageSense is an AI-powered Chrome extension that delivers real-time page summarization and contextual Q&A using Groq LLM, with optional RAG support via Qdrant. It is designed as a lightweight, privacy-aware assistant for understanding and querying web content directly within the browser.

Built with a production-ready FastAPI backend and a Manifest V3 Chrome extension frontend.

---

## What It Does
- Extracts and cleans main content from any webpage  
- Generates concise summaries using Groq LLM  
- Answers contextual questions grounded in page content  
- Supports multi-page comparison for cross-source analysis  
- Maintains chat memory (3 chats per user, 50 messages each)  
- Uses vector embeddings for retrieval-augmented answers  
- Redacts sensitive information automatically  

---

## Architecture Overview
PageSense consists of two primary components : 

### 1. Chrome Extension (Client Layer)
- Injects a React-based widget into web pages  
- Extracts visible content via content scripts  
- Sends structured requests to backend APIs  
- Maintains lightweight client-side state  

### 2. FastAPI Backend (AI Layer)
- Handles authentication and session management  
- Processes content extraction and normalization  
- Integrates Groq LLM for summarization and Q&A  
- Uses Qdrant for embedding storage and retrieval (RAG)  
- Manages persistent chat memory in PostgreSQL  
- Applies privacy filtering before LLM processing  

---

## AI & Retrieval Pipeline
1. Page content is extracted and cleaned.
2. Text is chunked and embedded using sentence transformers.
3. Embeddings are stored in Qdrant (vector DB).
4. For Q&A:
   - Relevant chunks are retrieved via similarity search.
   - Retrieved context is injected into the LLM prompt.
5. Groq LLM generates a grounded answer with references.

This ensures:
- Context-aware responses  
- Reduced hallucination  
- Source-grounded summaries  

---

## Technical Highlights
- Groq LLM integration  
- Retrieval-Augmented Generation (RAG) via Qdrant  
- Context chunking and embedding pipeline  
- Chat-scoped persistent memory with strict limits  
- Sensitive data redaction before model calls  
- FastAPI-based async backend  
- Chrome Extension Manifest V3 architecture  

---

## Memory & Constraints
- Maximum 3 chats per user  
- Maximum 50 messages per chat  
- Chat-specific memory context  
- Persistent conversation state stored in Postgres  

---

## Tech Stack
**Backend:**  
- FastAPI, PostgreSQL (SQLAlchemy), Redis  
- Qdrant (Vector DB)  
- Groq API  
- Sentence Transformers (embeddings)

**Frontend (Extension):**  
- React 18  
- Webpack 5  
- Chrome Extension Manifest V3  

**Infrastructure:**  
- Docker, Docker Compose  

PageSense demonstrates applied LLM engineering in a real-world browser environment, combining content extraction, retrieval pipelines, memory management, and low-latency inference.
