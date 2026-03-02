# PageSense - Complete Project Summary

## What Is PageSense?

PageSense is a production-ready, AI-powered Chrome Extension that lets users summarize any web page and ask contextual questions about its content — directly from their browser. It uses a RAG (Retrieval Augmented Generation) pipeline backed by OpenAI GPT-4o, Qdrant vector search, and MongoDB for persistence.

---

## Tech Stack Overview

### Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI | 0.109.0 |
| Runtime | Python | 3.11 |
| ASGI Server | Uvicorn | 0.27.0 |
| Production Server | Gunicorn | 21.2.0 |
| Primary Database | MongoDB (Motor async driver) | Motor 3.3.0 |
| Vector Database | Qdrant | Client ≥ 1.7.0 |
| Cache & Rate Limiting | Redis | redis 5.0.1 |
| LLM | OpenAI GPT-4o | openai ≥ 1.30.0 |
| Embedding Model | sentence-transformers/all-MiniLM-L6-v2 | sentence-transformers ≥ 2.3.1 |
| Content Extraction | Readability + BeautifulSoup4 | readability-lxml ≥ 0.8.1 |
| HTML Parsing | lxml | ≥ 5.1.0 |
| HTML → Text | html2text | ≥ 2024.2.26 |
| Auth | JWT + Google OAuth 2.0 | python-jose ≥ 3.3.0, google-auth |
| Password Hashing | Bcrypt via passlib | passlib[bcrypt] ≥ 1.7.4 |
| Data Validation | Pydantic v2 | ≥ 2.5, < 3 |
| Config Management | Pydantic Settings | ≥ 2.1 |
| Async HTTP | httpx | ≥ 0.26.0 |
| Retry Logic | tenacity | ≥ 8.2.3 |
| Monitoring | Prometheus + Sentry | prometheus-client ≥ 0.19.0 |
| Testing | pytest + pytest-asyncio | ≥ 7.4.4 |
| Linting / Formatting | flake8, black, mypy | Latest |

### Frontend (Chrome Extension)

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 18 |
| Language | TypeScript | 5.4.5 |
| Build Tool | Webpack | 5 |
| Transpiler | Babel 7 | — |
| Styling | TailwindCSS | 3.4.4 |
| CSS Processing | PostCSS | 8.4.38 |
| Animation | Framer Motion | 11.2.10 |
| Icons | Lucide React | 0.383.0 |
| Headless UI | Radix UI (scroll-area, separator, slot, tooltip) | — |
| Forms | React Hook Form | 7.51.5 |
| Form Validation | Zod + @hookform/resolvers | 3.23.8 |
| Class Utilities | clsx, tailwind-merge, class-variance-authority | — |
| Extension Platform | Chrome Extension Manifest V3 | — |
| Chrome Types | @types/chrome | 0.0.270 |
| Code Quality | ESLint 8, Prettier 3 | — |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Containerization | Docker (python:3.11-slim base) |
| Orchestration | Docker Compose |
| Services | MongoDB 7, Redis 7-alpine, Qdrant (latest), FastAPI backend |

---

## How MongoDB Is Used

MongoDB is the **primary relational-style datastore** for all user and conversation data. The async [Motor](https://motor.readthedocs.io/) driver is used throughout so every DB call is non-blocking.

### Collections

**`users`** — user accounts
```json
{
  "_id": "ObjectId",
  "email": "string (unique index)",
  "hashed_password": "string",
  "is_active": "boolean",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**`chats`** — chat sessions (capped at 3 per user)
```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "title": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```
Index: `(user_id, updated_at DESC)`

**`chat_urls`** — Q&A and summary history per (chat × URL) pair
```json
{
  "_id": "ObjectId",
  "chat_id": "string",
  "url_id": "string (SHA256 hash of URL)",
  "url": "string",
  "qa": [
    {
      "question": "string",
      "answer": "string",
      "sources": "array",
      "type": "qa | summary",
      "created_at": "datetime"
    }
  ],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```
Unique index: `(chat_id, url_id)`

**`urls`** — global URL store; one document per unique URL across all users
```json
{
  "_id": "url_id (first 24 chars of SHA256)",
  "url": "string",
  "full_context": "string (all chunks concatenated)",
  "summarised_context": "string",
  "summarising": "boolean (write lock)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Why MongoDB Over a Relational DB?

The Q&A history inside `chat_urls` is stored as an embedded array rather than a separate join table, which makes single-document retrieval of an entire conversation fast. The schema is document-oriented by design — each page visit is a self-contained unit with its own message thread.

---

## How Qdrant Is Used

Qdrant is the **vector database** that powers the semantic retrieval step of the RAG pipeline.

### Collection Setup

| Parameter | Value |
|-----------|-------|
| Collection name | `pagesense_embeddings` |
| Distance metric | Cosine |
| Vector dimension | 384 (matches all-MiniLM-L6-v2) |

### Operations

**Indexing** (`vector_store.py → add_chunks`)
- Each text chunk is passed through `sentence-transformers/all-MiniLM-L6-v2` to produce a 384-dim dense vector.
- A `PointStruct` is created per chunk with:
  - **ID**: MD5 hash of `{user_id}:{page_id}:{chunk_id}` — deterministic so re-indexing the same content is idempotent.
  - **Vector**: 384-dim float list.
  - **Payload**: `{ text, start_char, end_char, page_id, user_id, dom_selector }` — the metadata needed to reconstruct citations.
- Points are upserted in bulk.

**Retrieval** (`vector_store.py → search`)
- The query text is embedded with the same model.
- A Qdrant `search` call with a filter on `user_id` (and optionally `page_id`) retrieves the top-5 most similar chunks by cosine score.
- For comparative/multi-page questions the filter is broadened to all URLs in the current chat.

**Cleanup**
- `delete_page_vectors(page_id, user_id)` — removes all vectors for a specific page.
- `delete_user_vectors(user_id)` — removes all vectors for a user (account deletion).

---

## RAG Pipeline

```
Web Page HTML
      │
      ▼
Content Extraction (Readability + BeautifulSoup)
      │  clean text
      ▼
Chunking (1500 chars, 200-char overlap, sentence-boundary aware)
      │  TextChunk objects
      ▼
Embedding (all-MiniLM-L6-v2 → 384-dim vector)
      │
      ├──► Qdrant  (vector + payload stored)
      └──► MongoDB urls collection  (full_context stored)

          ─────── Query time ───────

User Question
      │
      ▼
Embed Question (same model)
      │
      ▼
Qdrant Vector Search (top-5, filtered by user_id / page_id)
      │  retrieved chunks with cosine scores
      ▼
Context Assembly
  ├── Single-page:   chunks from current page
  └── Multi-page:    chunks from all pages in chat, labelled [PAGE N: <url>]
      │
      ▼
OpenAI GPT-4o (temperature=0, max_tokens=1024)
  System prompt: "Answer ONLY from the provided content. Cite sources."
      │
      ▼
Answer + Source Citations
      │
      ▼
Stored in MongoDB chat_urls.qa[]
```

### Chunking Details

- **Chunk size**: 1500 characters
- **Overlap**: 200 characters (preserves context across chunk boundaries)
- **Boundary detection**: prefers sentence endings (`.`, `!`, `?`) over hard cuts
- Each chunk carries `start_char` / `end_char` and a `dom_selector` for in-page highlighting

### Reranking Approach

PageSense does **not** use a cross-encoder or external reranker. Ranking is a two-step heuristic:

1. **Cosine Similarity (Qdrant)** — primary ranking. The top-5 chunks by cosine score are retrieved from Qdrant and passed to the LLM.
2. **Word-Overlap Scoring** (`qa_service.py → _extract_relevant_sources`) — after the LLM produces an answer, each retrieved chunk is scored by counting how many answer words appear in that chunk. The top-3 chunks by overlap score are returned as source citations to the user.

This keeps latency low while still surfacing the chunks most responsible for the final answer.

### Comparative / Multi-Page QA

Keyword matching (`compare`, `versus`, `difference`, `similar`, `better`, etc.) flags a question as comparative. When triggered:
- All URLs visited within the active chat are queried in Qdrant.
- Chunks from each page are prefixed with `[PAGE N: <url>]` in the context window.
- The LLM uses a comparison-specific system prompt requesting structured output (tables or bullet lists).

---

## Authentication & Security

| Mechanism | Implementation |
|-----------|---------------|
| Registration / Login | Email + password hashed with bcrypt via passlib |
| Google OAuth | Google ID token verified server-side with `google-auth`, issues JWT |
| Session tokens | HS256 JWT, 7-day expiry (`python-jose`) |
| Rate limiting | Redis sliding window — 60 req/min, 1000 req/hr per user |
| Sensitive data redaction | Regex patterns strip credit-card numbers, SSNs, email addresses from extracted content before it leaves the browser |
| CORS | Configurable via `CORS_ORIGINS` (default `*` in dev) |
| Input validation | Pydantic v2 schemas on all endpoints |
| GZip compression | FastAPI middleware, threshold 1000 bytes |

---

## AI Models & Prompting

### LLM — OpenAI GPT-4o

| Parameter | Value |
|-----------|-------|
| Model ID | `gpt-4o` |
| Temperature | 0.0 (deterministic) |
| Max tokens | 1024 |
| API | OpenAI REST API |

**System prompts by task:**

- **Short summary** — 2–4 sentences: main topic, key finding, conclusion.
- **Long summary** — multi-paragraph with clear structure (topic → arguments → details → conclusion).
- **Bullet summary** — 5–10 concrete bullet points with data and examples.
- **Q&A** — answer only from provided content; acknowledge gaps; include specific citations.
- **Comparison** — label information by source page; structured table/bullet format; no invented information.

### Embedding Model — sentence-transformers/all-MiniLM-L6-v2

| Parameter | Value |
|-----------|-------|
| Dimensions | 384 |
| Hosted | Locally via HuggingFace / sentence-transformers |
| Purpose | Text → dense vector for Qdrant storage and query |

---

## API Endpoints

Base path: `/api/v1`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Email/password registration |
| `/auth/login` | POST | Email/password login → JWT |
| `/auth/google` | POST | Google ID token → JWT |
| `/auth/me` | GET | Current user profile |
| `/extract/` | POST | Extract and chunk page content |
| `/summarize/` | POST | Summarize chunks via GPT-4o |
| `/qa/` | POST | Contextual Q&A with Qdrant RAG |
| `/chat/` | GET / POST | List or create chats (max 3) |
| `/chat/{id}` | GET / DELETE | Retrieve or delete a chat |
| `/embed/` | POST | Manually create an embedding |
| `/embed/health` | GET | Vector store health check |
| `/health` | GET | Service health |
| `/metrics` | GET | Prometheus metrics |

---

## Project Structure

```
PageSense/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── auth.py              # JWT + Google OAuth endpoints
│   │   │   ├── extract.py           # Content extraction endpoint
│   │   │   ├── summarize.py         # GPT-4o summarization endpoint
│   │   │   ├── qa.py                # RAG Q&A endpoint
│   │   │   ├── chat.py              # Chat CRUD endpoints
│   │   │   └── embed.py             # Embedding / vector store endpoints
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic Settings (all env vars)
│   │   │   ├── database.py          # Motor async MongoDB client
│   │   │   ├── redis_client.py      # Redis cache + rate limiter
│   │   │   └── security.py          # JWT helpers, bcrypt, Google OAuth
│   │   ├── models/
│   │   │   └── documents.py         # Pydantic MongoDB document models
│   │   ├── schemas/
│   │   │   └── schemas.py           # Request / response Pydantic schemas
│   │   └── services/
│   │       ├── content_extractor.py # Readability + BeautifulSoup + chunking
│   │       ├── llm_service.py       # OpenAI GPT-4o integration
│   │       ├── vector_store.py      # Qdrant read/write/delete
│   │       ├── qa_service.py        # RAG orchestration + comparative detection
│   │       ├── chat_service.py      # Chat CRUD business logic
│   │       ├── url_service.py       # Global URL document management
│   │       └── summary_service.py   # Summary orchestration
│   ├── main.py                      # FastAPI app entry point (CORS, GZip, Sentry)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/chrome-extension/
│   ├── src/
│   │   ├── background.js            # Service worker: message hub, Google OAuth, state
│   │   ├── content.js               # Content script: widget injection, page extraction
│   │   ├── widget.tsx               # Main React widget (TypeScript)
│   │   ├── widget.css               # Widget base styles
│   │   ├── components/
│   │   │   ├── layout/              # Header, TabBar, PageInfoBar
│   │   │   ├── chat/                # ChatSidebar, MessageBubble, MessageInput, MessageList
│   │   │   ├── summary/             # SummaryView, SummaryCard
│   │   │   ├── screens/             # LoginScreen
│   │   │   └── ui/                  # Badge, Button, ScrollArea (Radix UI wrappers)
│   │   ├── types/                   # TypeScript type definitions
│   │   └── lib/                     # Utility helpers (clsx, tailwind-merge)
│   ├── public/
│   │   ├── widget.html
│   │   ├── popup.html
│   │   └── content.css
│   ├── manifest.json                # Manifest V3
│   ├── package.json
│   └── webpack.config.js
│
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── QUICKSTART.md
│
├── docker-compose.yml               # MongoDB 7, Redis 7, Qdrant, backend
├── setup.sh
└── README.md
```

---

## Docker Services

```yaml
# docker-compose.yml services
mongodb:   # MongoDB 7        — port 27017, volume mongodb_data
redis:     # Redis 7-alpine   — port 6379,  volume redis_data
qdrant:    # Qdrant latest    — ports 6333/6334, volume qdrant_data
backend:   # FastAPI (Python 3.11-slim) — port 8000
```

---

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
SECRET_KEY=...                          # 32+ char random string
JWT_SECRET_KEY=...                      # 32+ char random string

# Service connections (Docker defaults)
MONGODB_URL=mongodb://mongodb:27017
MONGODB_DB_NAME=pagesense
REDIS_URL=redis://redis:6379/0
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION_NAME=pagesense_embeddings

# LLM
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=1024
OPENAI_TEMPERATURE=0.0

# Embedding
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384

# Chunking
CHUNK_SIZE=1500
CHUNK_OVERLAP=200

# Rate limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# App limits
MAX_CHATS_PER_USER=3
MAX_QA_PER_CHAT_URL=200

# Cache
REDIS_CACHE_TTL=86400   # 24 hours

# Optional
API_ENV=development
DEBUG=True
SENTRY_DSN=
QDRANT_API_KEY=
```

---

## Getting Started

### Automated Setup

```bash
./setup.sh
```

This starts all Docker services, waits for them to be ready, and builds the Chrome extension.

### Manual Setup

```bash
# Start backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add OPENAI_API_KEY, GOOGLE_CLIENT_ID, SECRET_KEY, JWT_SECRET_KEY to .env
uvicorn app.main:app --reload

# Build extension
cd ../frontend/chrome-extension
npm install
npm run build
# Load dist/ folder in Chrome via chrome://extensions → Load unpacked
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| MongoDB over PostgreSQL | Document model maps naturally to per-page Q&A threads; embedded arrays avoid joins for chat history retrieval |
| Motor (async) over PyMongo | Keeps FastAPI's async event loop unblocked for concurrent requests |
| all-MiniLM-L6-v2 locally | Fast, low-resource 384-dim embeddings without external API call |
| Cosine + word-overlap reranking | Sufficient precision for single-page RAG without the latency of a cross-encoder |
| 1500-char chunks, 200-char overlap | Balances GPT-4o context window usage against retrieval granularity |
| Max 3 chats per user | Keeps per-user Qdrant vector count bounded; prevents unbounded storage growth |
| SHA256 URL IDs | Deterministic deduplication — the same URL is never stored twice in `urls` collection |
| Manifest V3 service worker | Required for Chrome Web Store compliance; handles OAuth and global session state |

---

## Performance Characteristics

| Operation | Typical latency |
|-----------|----------------|
| Content extraction | < 1 s |
| Embedding 1 chunk | < 50 ms (local model) |
| Qdrant vector search (top-5) | < 20 ms |
| GPT-4o response | 1–4 s |
| End-to-end Q&A (uncached) | 2–5 s |
| End-to-end summary (cached) | < 500 ms |

Redis caches summaries with a 24-hour TTL — revisiting the same page returns instantly.

---

## Security Checklist

- JWT tokens — 7-day expiry, HS256 signed
- Bcrypt password hashing (passlib)
- Google ID token server-side verification
- Redis-based rate limiting (60/min, 1000/hr per user)
- Pydantic v2 input validation on all endpoints
- Sensitive data redaction (credit cards, SSNs, emails) before content leaves the browser
- CORS configurable per environment
- GZip middleware (reduces response size)
- Sentry integration for production error tracking

---

**Status**: Production-ready (add API keys and secrets, then `./setup.sh`)

**Stack summary**: FastAPI · MongoDB · Qdrant · Redis · OpenAI GPT-4o · sentence-transformers · React 18 · TypeScript · TailwindCSS · Framer Motion · Chrome MV3 · Docker Compose
