#!/bin/bash

# Wee Party Development Server Startup Script
# Starts backend and both frontend clients

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get private IP
PRIVATE_IP=$(hostname -I | awk '{print $1}')

# Ports
BACKEND_PORT=5000
PC_PORT=4200
PHONE_PORT=4201

# Project directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend/WeeParty.Api"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# .NET path
export PATH="$HOME/.dotnet:$PATH"
export DOTNET_ROOT="$HOME/.dotnet"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"
    kill $BACKEND_PID $PC_PID $PHONE_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Print banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    🎮 Wee Party 🎮                        ║"
echo "║              Development Server Startup                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v dotnet &> /dev/null; then
    if [ -f "$HOME/.dotnet/dotnet" ]; then
        echo -e "${GREEN}✓ .NET SDK found at ~/.dotnet${NC}"
    else
        echo -e "${RED}✗ .NET SDK not found. Please install it first.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .NET SDK found${NC}"
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install it first.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Node.js $(node --version) found${NC}"
fi

# Build shared library first
echo -e "\n${YELLOW}Building shared library...${NC}"
cd "$FRONTEND_DIR"
npx ng build shared --configuration development > /dev/null 2>&1
echo -e "${GREEN}✓ Shared library built${NC}"

# Start backend
echo -e "\n${YELLOW}Starting backend server...${NC}"
cd "$BACKEND_DIR"
dotnet run --urls "http://0.0.0.0:$BACKEND_PORT" > /tmp/wee-party-backend.log 2>&1 &
BACKEND_PID=$!
sleep 2

if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}✗ Backend failed to start. Check /tmp/wee-party-backend.log${NC}"
    exit 1
fi

# Start PC client
echo -e "\n${YELLOW}Starting PC client...${NC}"
cd "$FRONTEND_DIR"
npx ng serve pc-client --host 0.0.0.0 --port $PC_PORT > /tmp/wee-party-pc.log 2>&1 &
PC_PID=$!

# Start Phone client
echo -e "${YELLOW}Starting Phone client...${NC}"
npx ng serve phone-client --host 0.0.0.0 --port $PHONE_PORT > /tmp/wee-party-phone.log 2>&1 &
PHONE_PID=$!

# Wait for Angular to compile
echo -e "\n${YELLOW}Waiting for Angular compilation (this may take a moment)...${NC}"
sleep 15

# Check if servers are running
echo ""
if kill -0 $PC_PID 2>/dev/null; then
    echo -e "${GREEN}✓ PC client started (PID: $PC_PID)${NC}"
else
    echo -e "${RED}✗ PC client failed. Check /tmp/wee-party-pc.log${NC}"
fi

if kill -0 $PHONE_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Phone client started (PID: $PHONE_PID)${NC}"
else
    echo -e "${RED}✗ Phone client failed. Check /tmp/wee-party-phone.log${NC}"
fi

# Print access information
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All servers running!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}PC Client (open on your computer):${NC}"
echo -e "    Local:   ${GREEN}http://localhost:$PC_PORT${NC}"
echo -e "    Network: ${GREEN}http://$PRIVATE_IP:$PC_PORT${NC}"
echo ""
echo -e "  ${YELLOW}Phone Client (open on your phone):${NC}"
echo -e "    Network: ${GREEN}http://$PRIVATE_IP:$PHONE_PORT${NC}"
echo ""
echo -e "  ${YELLOW}Backend API:${NC}"
echo -e "    ${GREEN}http://$PRIVATE_IP:$BACKEND_PORT${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "  ${YELLOW}Logs:${NC}"
echo -e "    Backend: /tmp/wee-party-backend.log"
echo -e "    PC:      /tmp/wee-party-pc.log"
echo -e "    Phone:   /tmp/wee-party-phone.log"
echo ""
echo -e "  Press ${RED}Ctrl+C${NC} to stop all servers"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Wait for all processes
wait
