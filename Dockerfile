# =============================================================================
# AppDock - Unified Docker Image
# Single image chứa cả Backend (Go) và Frontend (React)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ ./

# Build production
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Build Backend
# -----------------------------------------------------------------------------
FROM golang:1.24-alpine AS backend-builder

# Cài đặt các dependencies cần thiết
RUN apk add --no-cache git ca-certificates

WORKDIR /backend

# Copy go mod files
COPY backend/go.mod backend/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY backend/ ./

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o appdock .

# -----------------------------------------------------------------------------
# Stage 3: Final Production Image
# -----------------------------------------------------------------------------
FROM alpine:latest

# Cài đặt ca-certificates cho HTTPS và tzdata cho timezone
RUN apk --no-cache add ca-certificates tzdata

# Tạo non-root user cho security
RUN addgroup -S appdock && adduser -S appdock -G appdock

WORKDIR /app

# Copy backend binary
COPY --from=backend-builder /backend/appdock .

# Copy frontend build
COPY --from=frontend-builder /frontend/dist ./static

# Set environment variables
ENV PORT=3000
ENV STATIC_PATH=/app/static
ENV GIN_MODE=release

# Expose port
EXPOSE 3000

# Chạy với root user vì cần access Docker socket
# Trong production, bạn có thể map Docker socket với proper permissions
USER root

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/system/info || exit 1

# Run the application
CMD ["./appdock"]
