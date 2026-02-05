# PageSense API Documentation

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require authentication via JWT Bearer token.

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1...",
  "token_type": "bearer"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1...",
  "token_type": "bearer"
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>

Response:
{
  "id": 1,
  "email": "user@example.com",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00"
}
```

## Content Extraction

### Extract Page Content
```http
POST /extract/
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com",
  "html": "<html>...</html>",  // Optional
  "include_images": false
}

Response:
{
  "text_chunks": [
    {
      "id": "abc123",
      "text": "Page content...",
      "start_char": 0,
      "end_char": 100,
      "dom_selector": null
    }
  ],
  "meta": {
    "url": "https://example.com",
    "word_count": 500,
    "headings": [...],
    "links": [...]
  },
  "url": "https://example.com",
  "title": "Page Title"
}
```

## Summarization

### Summarize Page
```http
POST /summarize/
Authorization: Bearer <token>
Content-Type: application/json

{
  "chunks": [...],  // From extract endpoint
  "summary_style": "short",  // "short", "long", or "bullet"
  "max_tokens": 512,
  "chat_id": 1  // Optional
}

Response:
{
  "summary": "This page discusses...",
  "sources": [
    {
      "chunk_id": "abc123",
      "score": 0.9,
      "selector": null,
      "text": "Source excerpt..."
    }
  ],
  "cost_estimate": 0.001,
  "response_time_ms": 1500
}
```

## Question & Answer

### Ask Question
```http
POST /qa/
Authorization: Bearer <token>
Content-Type: application/json

{
  "question": "What is the main topic?",
  "chunks": [...],  // From extract endpoint
  "chat_id": 1,  // Optional
  "chat_history": [  // Optional
    {
      "role": "user",
      "content": "Previous question"
    },
    {
      "role": "assistant",
      "content": "Previous answer"
    }
  ]
}

Response:
{
  "answer": "The main topic is...",
  "sources": [...],
  "confidence": 0.85,
  "raw_llm_response": "The main topic is...",
  "response_time_ms": 2000
}
```

### Multi-Page Comparison
```http
POST /qa/multi-page
Authorization: Bearer <token>
Content-Type: application/json

{
  "question": "What are the differences between these pages?",
  "urls": [
    "https://example1.com",
    "https://example2.com"
  ],
  "chat_id": 1  // Optional
}

Response:
{
  "answer": "The main differences are...",
  "sources": [...],
  "pages_analyzed": [
    "https://example1.com",
    "https://example2.com"
  ],
  "response_time_ms": 3500
}
```

## Chat Management

### Create Chat
```http
POST /chat/
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My Research Chat"  // Optional
}

Response:
{
  "id": 1,
  "user_id": 1,
  "title": "My Research Chat",
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00",
  "message_count": 0
}
```

### List Chats
```http
GET /chat/
Authorization: Bearer <token>

Response:
[
  {
    "id": 1,
    "user_id": 1,
    "title": "My Research Chat",
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
    "message_count": 5
  }
]
```

### Get Chat History
```http
GET /chat/{chat_id}
Authorization: Bearer <token>

Response:
{
  "chat": {
    "id": 1,
    "user_id": 1,
    "title": "My Research Chat",
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
    "message_count": 5
  },
  "messages": [
    {
      "id": 1,
      "chat_id": 1,
      "role": "user",
      "content": "What is this about?",
      "extra_data": {},
      "created_at": "2024-01-01T00:00:00"
    },
    {
      "id": 2,
      "chat_id": 1,
      "role": "assistant",
      "content": "This is about...",
      "extra_data": {
        "sources": [...]
      },
      "created_at": "2024-01-01T00:00:01"
    }
  ]
}
```

### Delete Chat
```http
DELETE /chat/{chat_id}
Authorization: Bearer <token>

Response:
{
  "message": "Chat deleted successfully"
}
```

## Embeddings & RAG

### Create Embedding
```http
POST /embed/
Authorization: Bearer <token>
Content-Type: application/json

{
  "doc_id": "page_123",
  "text": "Content to embed..."
}

Response:
{
  "doc_id": "page_123",
  "vector_id": "abc123def456",
  "success": true
}
```

### Check Embeddings Health
```http
GET /embed/health

Response:
{
  "status": "healthy",
  "service": "embeddings"
}
```

## Error Responses

All error responses follow this format:
```json
{
  "detail": "Error message here",
  "code": "ERROR_CODE"  // Optional
}
```

Common status codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limits

- **Per Minute**: 60 requests
- **Per Hour**: 1000 requests

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640000000
```

## Memory Constraints

Per the PRD requirements:
- **Maximum chats per user**: 3
- **Maximum messages per chat**: 50
- Each chat has its own memory context
- Memory is persistent and chat-driven

Attempting to exceed these limits will result in a `400 Bad Request` error.