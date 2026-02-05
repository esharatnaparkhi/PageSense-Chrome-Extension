# PageSense Quick Start Guide

Get PageSense up and running in 5 minutes!

## Prerequisites

Make sure you have installed:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)
- A [Groq API Key](https://console.groq.com/) (free tier available)

## Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone <repository-url>
cd pagesense

# Run the setup script
chmod +x setup.sh
./setup.sh
```

The setup script will:
- ✅ Start all Docker services (PostgreSQL, Redis, Qdrant, Backend)
- ✅ Build the Chrome extension
- ✅ Create configuration files

## Step 2: Configure API Key (1 minute)

```bash
# Edit the environment file
nano backend/.env

# Add your Groq API key:
GROQ_API_KEY=gsk_your_actual_api_key_here

# Save and exit (Ctrl+X, Y, Enter)

# Restart backend to apply changes
docker-compose restart backend
```

### Get a Free Groq API Key

1. Go to https://console.groq.com/
2. Sign up with Google/GitHub
3. Navigate to API Keys
4. Click "Create API Key"
5. Copy the key (starts with `gsk_`)

## Step 3: Install Chrome Extension (2 minutes)

### A. Open Chrome Extensions Page

1. Open Google Chrome
2. Type in address bar: `chrome://extensions/`
3. Press Enter

### B. Enable Developer Mode

1. Look for "Developer mode" toggle in the top-right corner
2. Click to enable it

### C. Load the Extension

1. Click "Load unpacked" button
2. Navigate to your project folder
3. Select: `pagesense/frontend/chrome-extension/dist/`
4. Click "Select Folder"

✅ You should see the PageSense icon in your extensions!

## Step 4: Create Account (30 seconds)

1. Click the PageSense extension icon in Chrome toolbar
2. Click "Sign Up" (or sign in if you have an account)
3. Enter email and password
4. Click "Create Account"

## Step 5: Try It Out! (30 seconds)

### Summarize a Page

1. Navigate to any article or blog post
2. Click the purple floating button (bottom-right corner)
3. Click "Summarize Page"
4. Watch the magic happen! ✨

### Ask Questions

1. Switch to the "Ask" tab in the widget
2. Type a question like "What is the main topic?"
3. Press Enter or click Send
4. Get instant AI-powered answers!

## What You Can Do

### 📝 Page Summaries
- Get TL;DR summaries of any web page
- Choose between short, long, or bullet-point styles
- Copy summaries to clipboard

### 💬 Q&A Mode
- Ask questions about page content
- Get answers with source citations
- Maintain conversation context (up to 50 messages per chat)

### 🔍 Multi-Page Analysis
- Compare multiple pages
- Find differences and similarities
- Get comprehensive insights

### 🎯 Smart Features
- Automatic sensitive data detection
- Privacy-first design
- Fast responses (< 5 seconds)
- Beautiful, modern UI

## Verify Everything Works

### Check Backend Health

```bash
# Should return: {"status": "healthy"}
curl http://localhost:8000/health

# View API documentation
open http://localhost:8000/docs
```

### Check Services

```bash
# All services should show "Up"
docker-compose ps
```

Expected output:
```
NAME                    STATUS
pagesense-backend       Up
pagesense-postgres      Up (healthy)
pagesense-redis         Up (healthy)
pagesense-qdrant        Up (healthy)
```

## Common Issues & Solutions

### ❌ Extension Not Loading

**Problem**: Can't find the dist folder

**Solution**:
```bash
cd frontend/chrome-extension
npm install
npm run build
```

### ❌ Backend Won't Start

**Problem**: Port 8000 already in use

**Solution**:
```bash
# Find what's using port 8000
lsof -i :8000

# Stop it or change PageSense port in .env
API_PORT=8001
```

### ❌ API Key Invalid

**Problem**: "Invalid API key" error

**Solution**:
1. Double-check your Groq API key in `backend/.env`
2. Make sure there are no spaces or quotes around the key
3. Restart backend: `docker-compose restart backend`

### ❌ Can't Connect to Backend

**Problem**: Extension shows connection error

**Solution**:
1. Check backend is running: `docker-compose ps`
2. Verify URL in extension: should be `http://localhost:8000`
3. Check browser console for CORS errors

## Next Steps

### 🎨 Customize

- Edit widget colors in `frontend/chrome-extension/src/widget.css`
- Modify system prompts in `backend/app/services/llm_service.py`
- Add custom features to the extension

### 📊 Monitor Usage

```bash
# View real-time logs
docker-compose logs -f backend

# Check metrics
open http://localhost:8000/metrics
```

### 🚀 Deploy to Production

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- Production deployment options
- Chrome Web Store publishing
- Scaling guidelines
- Security best practices

## Support & Help

- 📖 **Full Documentation**: See [README.md](README.md)
- 🔌 **API Reference**: See [docs/API.md](docs/API.md)
- 🐛 **Issues**: Report bugs on GitHub
- 💡 **Feature Requests**: Open a discussion

## Advanced Usage

### Using Your Own API Key

1. Click the PageSense icon
2. Go to Settings
3. Enter your personal Groq API key
4. This overrides the default server-side key

### Managing Chats

- You can have up to **3 chats** at a time
- Each chat can have **50 messages**
- Delete old chats to create new ones

### RAG (Retrieval Augmented Generation)

Enable semantic search across your browsing history:
1. Install PostgreSQL and Qdrant (included in Docker setup)
2. Pages are automatically indexed when you summarize them
3. Ask questions across multiple previously-viewed pages

---

**🎉 Congratulations!** You're now ready to supercharge your web browsing with AI!

Happy summarizing! ✨