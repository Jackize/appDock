.PHONY: help install dev build start stop clean release docker-build docker-push

# Variables
VERSION ?= 1.0.0
DOCKER_COMPOSE = docker compose
DOCKER_USERNAME ?= nguyenhao2042
IMAGE_NAME = $(DOCKER_USERNAME)/appdock

# Colors
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
CYAN   := $(shell tput -Txterm setaf 6)
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
	@echo ''
	@echo 'Docker Hub:'
	@echo '  ${CYAN}DOCKER_USERNAME=myusername make docker-push${RESET}'

install: ## Cài đặt dependencies (dev mode)
	@echo "📦 Installing backend dependencies..."
	cd backend && go mod download
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Installation complete!"

build-frontend: ## Build frontend and copy assets to backend/static
	@echo "🔨 Building frontend..."
	cd frontend && npm ci && npm run build
	@echo "📦 Copying assets to backend/static..."
	cp -r frontend/dist/. backend/static/

build-binary: ## Compile Go binary only (BINARY=name GOOS=os GOARCH=arch)
	@echo "⚙️  Compiling binary..."
	cd backend && GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go build -ldflags="-s -w" -o $(or $(BINARY),appdock) .
	@echo "✅ Done! Run with: ./backend/$(or $(BINARY),appdock)"

build-agent: ## Build AppDock Agent binary (BINARY=name GOOS=os GOARCH=arch)
	@echo "⚙️  Building Agent binary..."
	cd agent && GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go build -ldflags="-s -w" -o $(or $(BINARY),appdock-agent) .
	@echo "✅ Agent built! Run with: ./agent/$(or $(BINARY),appdock-agent) --api-key=<key>"

build-local: build-frontend build-binary ## Build frontend + binary (BINARY=name GOOS=os GOARCH=arch)

build-all: build-frontend build-binary build-agent ## Build all components

dev: ## Chạy development mode (local)
	@echo "🚀 Starting development servers..."
	@echo "Backend: http://localhost:8080"
	@echo "Frontend: http://localhost:5173"
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run main.go

dev-frontend:
	cd frontend && npm run dev

dev-docker: ## Chạy development mode (Docker - 2 containers)
	@echo "🚀 Starting development containers..."
	$(DOCKER_COMPOSE) -f docker-compose.dev.yml up -d --build
	@echo ""
	@echo "✅ Development mode running!"
	@echo "🌐 Open http://localhost:3000 in your browser"

build: ## Build Docker image (single image)
	@echo "🔨 Building AppDock Docker image..."
	docker build -t appdock:latest -t appdock:$(VERSION) .
	@echo "✅ Build complete!"
	@echo "   Image: appdock:latest"
	@echo "   Image: appdock:$(VERSION)"

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
	$(DOCKER_COMPOSE) -f docker-compose.dev.yml down -v --rmi local 2>/dev/null || true
	docker rmi appdock:latest appdock:$(VERSION) 2>/dev/null || true
	@echo "✅ Cleanup complete!"

# ==================== Docker Hub ====================

docker-build: ## Build Docker image for Docker Hub
	@echo "🔨 Building Docker image for Docker Hub..."
	docker build -t $(IMAGE_NAME):latest -t $(IMAGE_NAME):$(VERSION) .
	@echo "✅ Build complete!"
	@echo "   Image: $(IMAGE_NAME):latest"
	@echo "   Image: $(IMAGE_NAME):$(VERSION)"

docker-push: docker-build ## Push image to Docker Hub
	@echo "🚀 Pushing to Docker Hub..."
	docker push $(IMAGE_NAME):latest
	docker push $(IMAGE_NAME):$(VERSION)
	@echo "✅ Pushed to Docker Hub!"
	@echo ""
	@echo "Users can now run:"
	@echo "  ${CYAN}docker run -d -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock $(IMAGE_NAME)${RESET}"

docker-buildx: ## Build multi-arch image (AMD64 + ARM64) and push
	@echo "🔨 Building multi-architecture image..."
	docker buildx create --name appdock-builder --use 2>/dev/null || docker buildx use appdock-builder
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t $(IMAGE_NAME):latest \
		-t $(IMAGE_NAME):$(VERSION) \
		--push .
	@echo "✅ Multi-arch image pushed to Docker Hub!"
	@echo "   Supports: linux/amd64, linux/arm64"

# ==================== Release ====================

release: docker-buildx ## Build and push release to Docker Hub
	@echo "📦 Release v$(VERSION) pushed to Docker Hub!"
	@echo ""
	@echo "To use AppDock:"
	@echo "  ${CYAN}docker run -d -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock $(IMAGE_NAME):$(VERSION)${RESET}"
