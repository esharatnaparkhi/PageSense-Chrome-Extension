# PageSense - AI Chrome Summarizer & Page-QA

PageSense is a lightweight Chrome extension that provides on-demand page summaries and contextual Q&A using AI (Groq LLM) with optional RAG capabilities.

## 🌟 Features

- **Instant Page Summarization**: Get concise TL;DR summaries of any web page
- **Contextual Q&A**: Ask questions about the current page content
- **Multi-Page Comparison**: Compare and analyze multiple pages simultaneously
- **Memory-Driven Chats**: Up to 3 chats per user, each with 50 messages
- **Privacy-First**: Automatic detection and redaction of sensitive information
- **Fast & Efficient**: Response times under 5 seconds for most queries
- **Modern UI**: Beautiful, unobtrusive widget interface

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (recommended)
- PostgreSQL 15+
- Redis 7+
- Qdrant (vector database)
- Groq API Key

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pagesense
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your configuration
# Important: Add your GROQ_API_KEY

# Run with Docker Compose (recommended)
cd ..
docker-compose up -d

# Or run manually
python main.py
```

### 3. Frontend Setup (Chrome Extension)

```bash
cd frontend/chrome-extension

# Install dependencies
npm install

# Build extension
npm run build

# The built extension will be in the 'dist' folder
```

### 4. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `frontend/chrome-extension/dist` folder
5. The PageSense icon should appear in your extensions

## 🏗️ Project Structure

```
pagesense/
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── api/v1/              # API endpoints
│   │   │   ├── auth.py          # Authentication
│   │   │   ├── extract.py       # Content extraction
│   │   │   ├── summarize.py     # Summarization
│   │   │   ├── qa.py            # Q&A & multi-page
│   │   │   ├── chat.py          # Chat management
│   │   │   └── embed.py         # Embeddings/RAG
│   │   ├── core/                # Core utilities
│   │   │   ├── config.py        # Settings
│   │   │   ├── database.py      # DB connection
│   │   │   ├── redis_client.py  # Redis client
│   │   │   └── security.py      # Auth utilities
│   │   ├── models/              # Database models
│   │   │   └── models.py        # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   │   └── schemas.py       # Request/response schemas
│   │   └── services/            # Business logic
│   │       ├── content_extractor.py  # Content extraction
│   │       ├── llm_service.py        # Groq LLM integration
│   │       └── vector_store.py       # Qdrant integration
│   ├── main.py                  # Application entry point
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile              # Docker configuration
│   └── .env.example            # Environment template
│
├── frontend/chrome-extension/   # Chrome extension
│   ├── src/
│   │   ├── background.js        # Service worker
│   │   ├── content.js           # Content script
│   │   ├── widget.jsx           # Main widget (React)
│   │   ├── widget.css           # Widget styles
│   │   ├── popup.jsx            # Extension popup (React)
│   │   └── popup.css            # Popup styles
│   ├── public/
│   │   ├── widget.html          # Widget HTML
│   │   ├── popup.html           # Popup HTML
│   │   └── content.css          # Injected styles
│   ├── manifest.json            # Extension manifest (V3)
│   ├── package.json             # Node dependencies
│   └── webpack.config.js        # Build configuration
│
├── docker-compose.yml           # Docker Compose setup
└── README.md                    # This file
```

## 🔧 Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# Security
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key

# Groq API
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=llama-3.3-70b-versatile

# Database
DATABASE_URL=postgresql://pagesense:pagesense@localhost:5432/pagesense

# Redis
REDIS_URL=redis://localhost:6379/0

# Qdrant
QDRANT_URL=http://localhost:6333

# Memory Limits (per PRD)
MAX_CHATS_PER_USER=3
MAX_MESSAGES_PER_CHAT=50
```

## 📡 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user

### Content Extraction
- `POST /api/v1/extract/` - Extract content from page

### Summarization
- `POST /api/v1/summarize/` - Summarize page content

### Question & Answer
- `POST /api/v1/qa/` - Answer question about page
- `POST /api/v1/qa/multi-page` - Compare multiple pages

### Chat Management
- `POST /api/v1/chat/` - Create new chat
- `GET /api/v1/chat/` - List all chats
- `GET /api/v1/chat/{id}` - Get chat history
- `DELETE /api/v1/chat/{id}` - Delete chat

### Embeddings
- `POST /api/v1/embed/` - Create embedding
- `GET /api/v1/embed/health` - Check embeddings service

## 🎨 Extension Usage

### 1. Summarize a Page
1. Click the floating PageSense button on any webpage
2. In the widget, click "Summarize Page"
3. Get instant summary with source citations

### 2. Ask Questions
1. Switch to the "Ask" tab in the widget
2. Type your question about the page
3. Get AI-powered answers with references

### 3. Compare Pages
1. Open PageSense on multiple pages
2. Ask comparative questions
3. Get analysis across all pages

## 🔒 Privacy & Security

- **Sensitive Data Detection**: Automatically detects and strips passwords, credit cards, SSNs
- **No API Keys in Extension**: Keys stored server-side
- **User Control**: Privacy toggle to opt out of server data storage
- **GDPR Compliant**: Data export and deletion available

## 🧪 Development

### Run Backend in Development Mode

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Build Extension in Development Mode

```bash
cd frontend/chrome-extension
npm run dev  # Watches for changes
```

### Run Tests

```bash
# Backend tests
cd backend
pytest

# Frontend linting
cd frontend/chrome-extension
npm run lint
```

## 📊 Technical Stack

### Backend
- **Framework**: FastAPI
- **Database**: PostgreSQL (SQLAlchemy)
- **Cache**: Redis
- **Vector DB**: Qdrant
- **LLM**: Groq API (Llama 3.3 70B)
- **Embeddings**: Sentence Transformers

### Frontend
- **Framework**: React 18
- **Build**: Webpack 5
- **UI**: Custom CSS with gradients
- **Icons**: Lucide React
- **Manifest**: Chrome Extension Manifest V3

## 🚢 Deployment

### Using Docker Compose

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Qdrant on port 6333
- FastAPI backend on port 8000

### Manual Deployment

See individual service documentation for manual deployment steps.

## 📝 Memory Management

Per the PRD requirements:
- **Maximum 3 chats per user**
- **Each chat contains up to 50 messages**
- **Each chat has its own memory context**
- **Memory is chat-driven and persistent**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

[Your License Here]

## 🆘 Support

For issues and questions:
- Open an issue on GitHub
- Contact: [your-email@example.com]

## 🎯 Roadmap

- [ ] Persistent Site Memory / Personal RAG
- [ ] Multilingual support
- [ ] Video summarization (via subtitles)
- [ ] Offline summarization (WebGPU)
- [ ] Entity extraction / Flashcards
- [ ] Phishing detection

---

Built with ❤️ using FastAPI, React, and Groq