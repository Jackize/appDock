#!/bin/bash

# =============================================================================
# AppDock Start Script
# Script khởi động AppDock trên Linux/macOS
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "  ___              ____             _    "
echo " / _ \            |  _ \           | |   "
echo "| |_| |_ __  _ __ | | | | ___   ___| | __"
echo "|  _  | '_ \| '_ \| | | |/ _ \ / __| |/ /"
echo "| | | | |_) | |_) | |_| | (_) | (__|   < "
echo "|_| |_| .__/| .__/|____/ \___/ \___|_|\_\\"
echo "      | |   | |                          "
echo "      |_|   |_|    Docker Management UI  "
echo -e "${NC}"

# Check if Docker is running
echo -e "${YELLOW}Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Determine start mode
MODE=${1:-compose}

case $MODE in
    "pull"|"docker")
        # Start from Docker Hub image
        IMAGE=${APPDOCK_IMAGE:-"nguyenhao2042/appdock:latest"}
        echo ""
        echo -e "${YELLOW}🚀 Starting AppDock from Docker Hub...${NC}"
        echo -e "   Image: ${CYAN}$IMAGE${NC}"
        
        # Stop existing container if running
        docker stop appdock 2>/dev/null || true
        docker rm appdock 2>/dev/null || true
        
        # Pull and run
        docker pull $IMAGE
        docker run -d \
            --name appdock \
            -p 3000:3000 \
            -v /var/run/docker.sock:/var/run/docker.sock \
            --restart unless-stopped \
            $IMAGE
        ;;
    
    "compose"|*)
        # Start with Docker Compose (build from source)
        if ! command -v docker &> /dev/null || ! docker compose version > /dev/null 2>&1; then
            echo -e "${RED}❌ Docker Compose is not available.${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Docker Compose is available${NC}"
        
        echo ""
        echo -e "${YELLOW}🚀 Building and starting AppDock...${NC}"
        docker compose up -d --build
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ AppDock is now running!${NC}"
    echo ""
    echo -e "🌐 Open ${GREEN}http://localhost:3000${NC} in your browser"
    echo ""
    echo "Commands:"
    echo -e "  ${YELLOW}docker compose down${NC}        - Stop AppDock"
    echo -e "  ${YELLOW}docker compose logs -f${NC}     - View logs"
    echo -e "  ${YELLOW}docker compose restart${NC}     - Restart"
    echo ""
    echo "Or if using Docker run:"
    echo -e "  ${YELLOW}docker stop appdock${NC}        - Stop"
    echo -e "  ${YELLOW}docker logs -f appdock${NC}     - View logs"
    echo -e "  ${YELLOW}docker start appdock${NC}       - Restart"
else
    echo -e "${RED}❌ Failed to start AppDock${NC}"
    exit 1
fi
