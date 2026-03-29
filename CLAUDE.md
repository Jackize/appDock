# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AppDock

AppDock is a Docker management UI — a web application for managing containers, images, networks, and volumes. The backend is Go (Gin), the frontend is React + TypeScript + Vite. In production, both are bundled into a single Docker image where the Go server also serves the built React assets.

## Commands

### Development (local)

```bash
# Backend (port 8080)
cd backend && go run main.go

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

### Development (Docker)

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Frontend

```bash
cd frontend
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npm run preview    # preview built app
```

### Backend

```bash
cd backend
go run main.go        # run server
go test ./...         # run tests
go build              # build binary
```

### Makefile shortcuts

```bash
make dev              # run backend + frontend locally
make dev-docker       # run via docker-compose.dev.yml
make build            # build unified Docker image
make start / stop     # docker-compose up/down
make logs             # view container logs
```

## Architecture

### Request flow (backend)

```
HTTP/WebSocket → CORS middleware → Auth middleware (JWT) → Handler → Service → Docker SDK
```

- Public routes (no auth): `GET /api/auth/status`, `POST /api/auth/login`
- Protected auth routes: `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/change-password`
- Protected routes: all other `/api/*` (Bearer token in `Authorization` header)
- WebSocket routes: `/ws/containers/:id/logs`, `/ws/containers/:id/exec` (Bearer token in `?token=` query param, not header)

### Backend structure (`backend/`)

```
main.go                    # entry point, router setup
internal/
  handlers/                # HTTP & WebSocket handlers (one per resource)
    auth_handler.go        # login, refresh, me, change-password
    system_handler.go      # system info & stats
    container_handler.go   # containers + WebSocket logs/exec
    image_handler.go / network_handler.go / volume_handler.go
  middleware/auth_middleware.go   # JWT Bearer; WebSocketAuthMiddleware uses query param
  services/
    auth_service.go        # JWT generation, SHA-256 password validation
    docker_service.go      # Docker SDK wrapper
    container_service.go   # container operations
    image_service.go / network_service.go / volume_service.go
```

### Frontend structure (`frontend/src/`)

```
App.tsx                    # route definitions, ProtectedRoute wrapper
pages/                     # one component per page
components/
  Layout.tsx / Header.tsx / Sidebar.tsx
  TabsPanel/               # container logs & terminal (uses xterm.js + WebSocket)
  ui/                      # reusable Radix UI-based components
stores/
  authStore.ts             # Zustand: JWT token, user
  appStore.ts              # Zustand: app-wide state
services/api.ts            # fetch wrapper, all API calls
hooks/useDocker.ts         # all React Query hooks in one file (useSystemInfo, useContainers, etc.)
lib/
  crypto.ts                # SHA-256 password hashing (pure JS for HTTP contexts)
  utils.ts                 # shared utilities (cn, etc.)
types/                     # TypeScript interfaces
```

### Production vs development image

| Mode | Description |
|------|-------------|
| Production (`Dockerfile`) | Multi-stage: Node builds React → Go builds backend → Alpine final image. Go binary serves `/assets/*` statically and proxies everything else. Port 3000. |
| Dev backend (`backend/Dockerfile`) | Go only, port 8080. |
| Dev frontend (`frontend/Dockerfile`) | Nginx serving built assets, proxies `/api/*` to backend. Port 80. |

### Authentication

1. Frontend hashes password with SHA-256 before sending
2. Backend compares with stored SHA-256 hash (from env `APPDOCK_PASSWORD`)
3. On match, returns JWT (24h expiry, secret from `APPDOCK_JWT_SECRET`)
4. Token stored in `localStorage`, sent as `Authorization: Bearer <token>`
5. Auth can be fully disabled with `APPDOCK_AUTH_DISABLED=true`

## Environment variables

Key variables (see `.env.example` for full list):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend listen port |
| `APPDOCK_USERNAME` | `admin` | Login username |
| `APPDOCK_PASSWORD` | `appdock` | Login password (plaintext; hashed on compare) |
| `APPDOCK_JWT_SECRET` | — | JWT signing secret (use a strong random value in prod) |
| `APPDOCK_AUTH_DISABLED` | `false` | Disable auth entirely |

Docker socket must be mounted: `-v /var/run/docker.sock:/var/run/docker.sock`

## CI/CD

- `.github/workflows/ci.yml` — runs on push/PR to `main`: builds backend (Go 1.24) and frontend (Node 20)
- `.github/workflows/docker-publish.yml` — runs on GitHub Release: builds multi-arch image (`linux/amd64`, `linux/arm64`) and pushes to Docker Hub. Multi-arch builds use QEMU emulation which is slow; see file for optimization notes.
