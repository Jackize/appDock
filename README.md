# 🚀 AppDock - Modern Docker Management UI

<div align="center">
  <img src="frontend/public/favicon.svg" alt="AppDock Logo" width="120" />
  <p><strong>A beautiful, intuitive Docker management interface</strong></p>
  
  ![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Docker](https://img.shields.io/badge/docker-required-blue.svg)
  ![Docker Pulls](https://img.shields.io/docker/pulls/nguyenhao2042/appdock.svg)
</div>

---

## ⚡ Quick Start

### Option 1: One-liner Install (Linux - Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/Jackize/appDock/main/install.sh | sudo bash
```

This will:
- Download the latest binary for your OS/architecture
- Install to `/opt/appdock`
- Create a systemd service (auto-start on boot)
- Start AppDock on port **8080**

Access UI at **http://localhost:8080**

### Option 2: Docker Run

```bash
docker run -d \
  --name appdock \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  nguyenhao2042/appdock:latest
```

Access UI at **http://localhost:8080**

### Option 3: Docker Compose

```bash
# Download docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Jackize/appDock/main/docker-compose.yml -o docker-compose.yml

# Start
docker compose up -d
```

### Option 4: Clone & Build

```bash
git clone https://github.com/Jackize/appDock.git
cd appDock
docker compose up -d --build
```

Access UI at **http://localhost:8080**

---

## ✨ Features

- 📊 **Dashboard** - Real-time system overview with charts
- 📦 **Containers** - Manage containers grouped by Docker Compose project
  - Start, Stop, Restart, Remove
  - 📋 Real-time logs streaming
  - 💻 Interactive terminal (exec into container)
- 🖼️ **Images** - Manage Docker images
  - Filter by used/unused images
  - Bulk delete unused images
- 🌐 **Networks** - Manage Docker networks
- 💾 **Volumes** - Manage Docker volumes
- 🔐 **Authentication** - JWT-based authentication (optional)

---

## 📦 Installation

### Native Installation (Linux/macOS)

**Install latest version:**

```bash
curl -fsSL https://raw.githubusercontent.com/Jackize/appDock/main/install.sh | sudo bash
```

**Install specific version:**

```bash
sudo ./install.sh --version v1.0.0
```

**Check installation status:**

```bash
./install.sh --status
```

**Uninstall:**

```bash
sudo ./install.sh --uninstall
```

### Service Management (Linux with systemd)

| Command | Description |
|---------|-------------|
| `systemctl status appdock` | Check service status |
| `systemctl start appdock` | Start AppDock |
| `systemctl stop appdock` | Stop AppDock |
| `systemctl restart appdock` | Restart AppDock |
| `journalctl -u appdock -f` | View logs |

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start AppDock |
| `docker compose down` | Stop AppDock |
| `docker compose logs -f` | View logs |
| `docker compose restart` | Restart |
| `docker compose pull && docker compose up -d` | Update |

### Makefile Shortcuts (for development)

```bash
make help      # Show help
make start     # Start AppDock
make stop      # Stop AppDock
make logs      # View logs
make clean     # Clean up
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server listen port |
| `APPDOCK_USERNAME` | `admin` | Login username |
| `APPDOCK_PASSWORD` | `appdock` | Login password |
| `APPDOCK_JWT_SECRET` | (random) | JWT signing secret |
| `APPDOCK_AUTH_DISABLED` | `false` | Set `true` to disable authentication |

### Authentication

AppDock includes JWT-based authentication by default.

**Default credentials:**
- Username: `admin`
- Password: `appdock`

**Disable authentication** (for trusted environments):

```bash
# Docker run
docker run -d \
  --name appdock \
  -p 8080:8080 \
  -e APPDOCK_AUTH_DISABLED=true \
  -v /var/run/docker.sock:/var/run/docker.sock \
  nguyenhao2042/appdock:latest
```

**Custom credentials:**

```bash
docker run -d \
  --name appdock \
  -p 8080:8080 \
  -e APPDOCK_USERNAME=myuser \
  -e APPDOCK_PASSWORD=mypassword \
  -e APPDOCK_JWT_SECRET=$(openssl rand -hex 32) \
  -v /var/run/docker.sock:/var/run/docker.sock \
  nguyenhao2042/appdock:latest
```

For native installation, edit the systemd service file at `/etc/systemd/system/appdock.service` and run `systemctl daemon-reload && systemctl restart appdock`.

---

## 🔧 Development Mode

### Requirements

- Node.js 18+
- Go 1.21+
- Docker running

### Setup & Run

```bash
# Install dependencies
make install

# Run dev mode (backend + frontend)
make dev
```

Or run separately:

```bash
# Terminal 1 - Backend (port 8080)
cd backend
go run main.go

# Terminal 2 - Frontend (port 5173)
cd frontend
npm install
npm run dev
```

Access dev UI at **http://localhost:5173**

---

## 🏗️ Tech Stack

### Frontend

- **React 18** + **Vite** - Fast build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Modern styling
- **Radix UI** - Headless UI components
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Recharts** - Charts and graphs

### Backend

- **Go (Golang)** - Backend API
- **Gin** - Web framework
- **Docker SDK** - Docker Engine interaction
- **Gorilla WebSocket** - Real-time logs & terminal

---

## 📁 Project Structure

```
appdock/
├── Dockerfile               # Unified Dockerfile (single image)
├── docker-compose.yml       # Production (single container)
├── docker-compose.dev.yml   # Development (2 containers)
├── install.sh               # Native installer script
├── Makefile                 # Build automation
│
├── backend/                 # Golang Backend
│   ├── Dockerfile           # Backend-only Dockerfile (dev)
│   ├── main.go
│   └── internal/
│       ├── handlers/        # HTTP & WebSocket handlers
│       ├── middleware/      # Auth middleware
│       └── services/        # Docker & auth services
│
├── frontend/                # React Frontend
│   ├── Dockerfile           # Frontend-only Dockerfile (dev)
│   ├── nginx.conf
│   └── src/
│       ├── components/      # UI components
│       ├── pages/           # Page components
│       ├── hooks/           # Custom hooks
│       ├── services/        # API services
│       ├── stores/          # Zustand stores
│       └── types/           # TypeScript types
│
└── scripts/                 # Start scripts
    ├── start.sh             # Linux/macOS
    └── start.bat            # Windows
```

---

## 🎨 Design

- **Dark Theme** - Dark gray background (#0f1419)
- **Blue/Teal Accent** - Accent colors (#0ea5e9, #14b8a6)
- **Be Vietnam Pro** - Clean Vietnamese-friendly font
- **Terminal-style** - Logs and Terminal with Tokyo Night theme

---

## 📖 API Endpoints

### Authentication

- `GET /api/auth/status` - Auth status (public)
- `POST /api/auth/login` - Login (public)
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### System

- `GET /api/system/info` - Docker info
- `GET /api/system/stats` - System statistics

### Containers

- `GET /api/containers` - List containers
- `GET /api/containers/:id` - Container details
- `POST /api/containers/:id/start` - Start container
- `POST /api/containers/:id/stop` - Stop container
- `POST /api/containers/:id/restart` - Restart container
- `DELETE /api/containers/:id` - Remove container
- `GET /api/containers/:id/logs` - Get logs
- `GET /api/containers/:id/stats` - Container stats

### WebSocket

- `WS /ws/containers/:id/logs?token=<jwt>` - Stream logs real-time
- `WS /ws/containers/:id/exec?token=<jwt>` - Terminal exec

### Images

- `GET /api/images` - List images
- `DELETE /api/images/:id` - Delete image
- `DELETE /api/images/bulk` - Bulk delete images
- `POST /api/images/pull` - Pull image

### Networks & Volumes

- `GET /api/networks` - List networks
- `GET /api/volumes` - List volumes

---

## 🚢 CI/CD with GitHub Actions

Docker images are automatically built and pushed to Docker Hub when creating a Release on GitHub.

### Setup GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token (create at https://hub.docker.com/settings/security) |

### Create a Release

1. Go to **Releases → Create a new release**
2. Create a new tag (e.g., `v1.0.0`)
3. Fill in release notes
4. Click **Publish release**

GitHub Actions will automatically:
- Build Docker image for both AMD64 and ARM64
- Push to Docker Hub with tags: `latest`, `1.0.0`, `1.0`, `1`
- Build native binaries for Linux/macOS

### Manual Build (Local)

```bash
# Build image
docker build -t appdock:latest .

# Tag with Docker Hub username
docker tag appdock:latest your-username/appdock:latest
docker tag appdock:latest your-username/appdock:v1.0.0

# Push to Docker Hub
docker push your-username/appdock:latest
docker push your-username/appdock:v1.0.0
```

### Multi-architecture Build (Local)

```bash
# Create builder (only needed once)
docker buildx create --name mybuilder --use

# Build and push for both Intel/AMD and Apple Silicon
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-username/appdock:latest \
  -t your-username/appdock:v1.0.0 \
  --push .
```

---

## 🔒 Security

⚠️ **Important**: AppDock requires access to Docker socket (`/var/run/docker.sock`). This allows full control of Docker on the host machine.

**Recommendations:**
- Only run in trusted environments
- Do not expose to the public internet without additional protection
- Use a firewall if needed
- Enable authentication (default) in production
- Use strong passwords and JWT secrets

---

## 📝 Roadmap

- [x] Real-time logs with WebSocket
- [x] Container exec terminal
- [x] Docker Compose project grouping
- [x] Bulk delete images
- [x] JWT Authentication
- [x] Native binary installation
- [ ] Multi-language support
- [ ] Dark/Light theme toggle
- [ ] Container resource limits
- [ ] Image build from Dockerfile

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📜 License

MIT License - Free to use and modify!

---

<div align="center">
  <p>Made with ❤️ in Vietnam 🇻🇳</p>
</div>
