#!/bin/bash

echo "🚀 Setting up PageSense..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed.${NC}"
    exit 1
fi

# Check Docker Compose (new syntax)
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not available. Is Docker Desktop running?${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose found${NC}"

# Setup .env
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}⚠ Creating backend/.env from template...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${RED}❗ Add your GROQ_API_KEY in backend/.env${NC}"
else
    echo -e "${GREEN}✓ backend/.env exists${NC}"
fi

# Start containers
echo -e "${YELLOW}📦 Starting Docker services...${NC}"
docker compose up -d --build

echo -e "${YELLOW}⏳ Waiting for services to initialize...${NC}"
sleep 10

# Check running containers
if docker compose ps | grep -q "running"; then
    echo -e "${GREEN}✓ Services started successfully${NC}"
else
    echo -e "${RED}❌ Some services failed to start${NC}"
    docker compose ps
    exit 1
fi

# Build Chrome extension
if command -v npm &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Chrome extension dependencies...${NC}"
    cd frontend/chrome-extension || exit
    npm install
    npm run build
    cd ../..
    echo -e "${GREEN}✓ Chrome extension built${NC}"
else
    echo -e "${YELLOW}⚠ Node.js not found — skipping extension build${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ PageSense setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}API:${NC} http://localhost:8000"
echo -e "${YELLOW}Docs:${NC} http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}Load extension from:${NC} frontend/chrome-extension/dist"
echo ""
echo -e "${YELLOW}Stop services:${NC} docker compose down"
echo -e "${YELLOW}Logs:${NC} docker compose logs -f"
