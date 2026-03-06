# PageSense

PageSense is an AI-powered Chrome extension that summarizes webpages and enables multi-page contextual Q&A directly inside the browser.
It implements a Retrieval-Augmented Generation (RAG) pipeline that extracts webpage content, indexes it as vector embeddings, retrieves relevant sections via semantic search, and generates grounded responses using GPT-4o.

# Features
- Instant webpage summarization
- Context-aware Q&A grounded in page content
- Multi-page comparison across visited URLs
- Chat-based browsing memory
- Vector retrieval with source citations
- Sensitive data redaction before model calls

# Architecture

PageSense consists of three layers.
- ### Chrome Extension
React-based widget injected into webpages that extracts content and renders summaries and chat responses.
- ### AI Backend : https://pagesense-chrome-extension-production.up.railway.app/docs 
FastAPI service that handles content extraction, embedding generation, vector retrieval, and LLM orchestration.
- ### Data Layer
MongoDB → users, chats, URL records, Q&A history
Qdrant → vector embeddings for semantic retrieval
Redis → caching and rate limiting

# Performance

| Operation            | Latency         |
| -------------------- | --------------- |
| Content extraction   | <1s             |
| Embedding generation | ~50ms per chunk |
| Vector search        | <20ms           |
| LLM response         | 1–4s            |
| End-to-end Q&A       | ~2–5s           |

# AI Agent Pipeline
PageSense follows a modular RAG pipeline.

- ### Extraction Agent
Extracts main content from HTML using Readability + PyMuPDF.
- ### Chunking Agent
Splits text into overlapping segments (1500 chars, 200 overlap).
- ### Embedding Agent
Generates dense vectors using openai-embeddings.

- ### Retrieval Agent
Performs cosine similarity search in Qdrant to retrieve top-K relevant chunks.

- ### Reasoning Agent
GPT-4o generates grounded summaries and answers from retrieved context.

- ### Attribution Agent
Ranks chunks via word-overlap scoring and returns the most relevant sources.

# RAG Flow

```
Web Page
   │
Content Extraction
   │
Text Chunking
   │
Embedding Generation
   │
Qdrant Vector Store
```

### Query Time

```
User Question
   │
Query Embedding
   │
Vector Search
   │
Context Assembly
   │
GPT-4o Reasoning
   │
Answer + Citations
```

# Stack summary
FastAPI · MongoDB · Qdrant · Redis · OpenAI GPT-4o · React 18 · TypeScript · TailwindCSS · Framer Motion · Chrome MV3 · Docker
