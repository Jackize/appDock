.PHONY: help install dev build start stop clean release

# Variables
VERSION ?= 1.0.0
DOCKER_COMPOSE = docker compose

# Colors
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

help: ## Hiển thị trợ giúp
	@echo ''
	@echo '${GREEN}AppDock - Docker Management UI${RESET}'
	@echo ''
	@echo 'Usage:'
	@echo '  ${YELLOW}make${RESET} ${GREEN}<target>${RESET}'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${YELLOW}%-15s${RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Cài đặt dependencies (dev mode)
	@echo "📦 Installing backend dependencies..."
	cd backend && go mod download
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Installation complete!"

dev: ## Chạy development mode
	@echo "🚀 Starting development servers..."
	@echo "Backend: http://localhost:8080"
	@echo "Frontend: http://localhost:5173"
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run main.go

dev-frontend:
	cd frontend && npm run dev

build: ## Build Docker images
	@echo "🔨 Building Docker images..."
	$(DOCKER_COMPOSE) build
	@echo "✅ Build complete!"

start: ## Khởi động AppDock (Docker Compose)
	@echo "🚀 Starting AppDock..."
	$(DOCKER_COMPOSE) up -d
	@echo ""
	@echo "✅ AppDock is running!"
	@echo "🌐 Open http://localhost:3000 in your browser"

stop: ## Dừng AppDock
	@echo "🛑 Stopping AppDock..."
	$(DOCKER_COMPOSE) down
	@echo "✅ AppDock stopped!"

restart: stop start ## Khởi động lại AppDock

logs: ## Xem logs
	$(DOCKER_COMPOSE) logs -f

clean: ## Dọn dẹp Docker images và containers
	@echo "🧹 Cleaning up..."
	$(DOCKER_COMPOSE) down -v --rmi local
	@echo "✅ Cleanup complete!"

# Build production binaries for multiple platforms
release: ## Build release binaries
	@echo "📦 Building release v$(VERSION)..."
	@mkdir -p dist
	
	# Build backend for multiple platforms
	@echo "Building backend..."
	cd backend && GOOS=linux GOARCH=amd64 go build -o ../dist/appdock-backend-linux-amd64 .
	cd backend && GOOS=linux GOARCH=arm64 go build -o ../dist/appdock-backend-linux-arm64 .
	cd backend && GOOS=darwin GOARCH=amd64 go build -o ../dist/appdock-backend-darwin-amd64 .
	cd backend && GOOS=darwin GOARCH=arm64 go build -o ../dist/appdock-backend-darwin-arm64 .
	cd backend && GOOS=windows GOARCH=amd64 go build -o ../dist/appdock-backend-windows-amd64.exe .
	
	# Build frontend
	@echo "Building frontend..."
	cd frontend && npm run build
	cp -r frontend/dist dist/frontend
	
	@echo "✅ Release v$(VERSION) built in ./dist/"
