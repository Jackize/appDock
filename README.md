# 🚀 AppDock - Quản lý Docker hiện đại

<div align="center">
  <img src="frontend/public/favicon.svg" alt="AppDock Logo" width="120" />
  <p><strong>Giao diện quản lý Docker trực quan, hiện đại với phong cách Việt Nam</strong></p>
  
  ![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Docker](https://img.shields.io/badge/docker-required-blue.svg)
</div>

---

## ⚡ Quick Start (1 lệnh duy nhất)

### Yêu cầu
- **Docker** và **Docker Compose** đang chạy trên máy

### Cài đặt & Chạy

**Linux/macOS:**
```bash
git clone https://github.com/your-username/appdock.git
cd appdock
./scripts/start.sh
```

**Windows:**
```cmd
git clone https://github.com/your-username/appdock.git
cd appdock
scripts\start.bat
```

**Hoặc dùng Docker Compose trực tiếp:**
```bash
docker compose up -d
```

🌐 Mở **http://localhost:3000** trong trình duyệt

---

## ✨ Tính năng

- 📊 **Dashboard** - Tổng quan về hệ thống Docker với biểu đồ realtime
- 📦 **Containers** - Quản lý containers theo nhóm Docker Compose
  - Start, Stop, Restart, Remove
  - 📋 Xem logs realtime
  - 💻 Terminal trực tiếp vào container
- 🖼️ **Images** - Quản lý images
  - Phân loại images đang sử dụng / không sử dụng
  - Xóa hàng loạt images không dùng
- 🌐 **Networks** - Quản lý Docker networks
- 💾 **Volumes** - Quản lý Docker volumes

---

## 🛠️ Commands

| Command | Mô tả |
|---------|-------|
| `docker compose up -d` | Khởi động AppDock |
| `docker compose down` | Dừng AppDock |
| `docker compose logs -f` | Xem logs |
| `docker compose restart` | Khởi động lại |
| `docker compose pull && docker compose up -d` | Cập nhật |

### Sử dụng Makefile (optional)

```bash
make help      # Hiển thị trợ giúp
make start     # Khởi động AppDock
make stop      # Dừng AppDock
make logs      # Xem logs
make clean     # Dọn dẹp
```

---

## 🔧 Development Mode

Nếu bạn muốn develop:

### Yêu cầu
- Node.js 18+
- Go 1.21+
- Docker đang chạy

### Cài đặt & Chạy

```bash
# Cài đặt dependencies
make install

# Chạy dev mode (backend + frontend)
make dev
```

Hoặc chạy riêng từng phần:

```bash
# Terminal 1 - Backend (port 8080)
cd backend
go run main.go

# Terminal 2 - Frontend (port 5173)
cd frontend
npm install
npm run dev
```

Truy cập **http://localhost:5173**

---

## 🏗️ Tech Stack

### Frontend
- **React 18** + **Vite** - Build tool siêu nhanh
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling hiện đại
- **Radix UI** - Headless UI components
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Recharts** - Charts và biểu đồ

### Backend
- **Go (Golang)** - Backend API
- **Gin** - Web framework
- **Docker SDK** - Tương tác với Docker Engine
- **Gorilla WebSocket** - Realtime logs & terminal

---

## 📁 Cấu trúc dự án

```
appdock/
├── backend/                  # Golang Backend
│   ├── Dockerfile
│   ├── main.go
│   └── internal/
│       ├── handlers/        # HTTP & WebSocket handlers
│       └── services/        # Docker service
│
├── frontend/                # React Frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── components/      # UI components
│       ├── pages/           # Page components
│       ├── hooks/           # Custom hooks
│       ├── services/        # API services
│       ├── stores/          # Zustand stores
│       └── types/           # TypeScript types
│
├── scripts/                 # Start scripts
│   ├── start.sh            # Linux/macOS
│   └── start.bat           # Windows
│
├── docker-compose.yml       # Docker Compose config
├── Makefile                 # Build automation
└── README.md
```

---

## 🎨 Thiết kế

- **Dark Theme** - Background xám đen (#0f1419)
- **Blue/Teal Accent** - Màu accent (#0ea5e9, #14b8a6)
- **Be Vietnam Pro** - Font chữ tiếng Việt đẹp
- **Terminal-style** - Logs và Terminal với theme Tokyo Night

---

## 📖 API Endpoints

### System
- `GET /api/system/info` - Thông tin Docker
- `GET /api/system/stats` - Thống kê hệ thống

### Containers
- `GET /api/containers` - Danh sách containers
- `GET /api/containers/:id` - Chi tiết container
- `POST /api/containers/:id/start` - Khởi động
- `POST /api/containers/:id/stop` - Dừng
- `POST /api/containers/:id/restart` - Khởi động lại
- `DELETE /api/containers/:id` - Xóa
- `GET /api/containers/:id/logs` - Xem logs
- `GET /api/containers/:id/stats` - Thống kê

### WebSocket
- `WS /ws/containers/:id/logs` - Stream logs realtime
- `WS /ws/containers/:id/exec` - Terminal exec

### Images
- `GET /api/images` - Danh sách images
- `DELETE /api/images/:id` - Xóa image
- `DELETE /api/images/bulk` - Xóa nhiều images
- `POST /api/images/pull` - Pull image

### Networks & Volumes
- `GET /api/networks` - Danh sách networks
- `GET /api/volumes` - Danh sách volumes

---

## 🔒 Bảo mật

⚠️ **Lưu ý**: AppDock cần quyền truy cập Docker socket (`/var/run/docker.sock`). Điều này cho phép quản lý toàn bộ Docker trên máy.

- Chỉ chạy trên môi trường tin cậy
- Không expose ra internet công cộng
- Sử dụng firewall nếu cần

---

## 📝 Roadmap

- [x] Real-time logs với WebSocket
- [x] Container exec terminal
- [x] Docker Compose project grouping
- [x] Bulk delete images
- [ ] Multi-language (Tiếng Anh)
- [ ] Dark/Light theme toggle
- [ ] Container resource limits
- [ ] Image build từ Dockerfile
- [ ] Authentication

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📜 License

MIT License - Tự do sử dụng và phát triển!

---

<div align="center">
  <p>Made with ❤️ in Vietnam 🇻🇳</p>
</div>
