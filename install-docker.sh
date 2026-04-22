#!/bin/bash
set -euo pipefail

# =============================================================================
# AppDock Docker Installer
# Installs (via Docker) and runs AppDock as a container (no systemd service).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Jackize/appDock/main/install-docker.sh | sudo bash
#   or: ./install-docker.sh [--version <tag>] [--port <port>] [--uninstall] [--status]
#
# Notes:
# - This script manages AppDock using Docker/Compose, not systemd.
# - Docker Engine itself must be installed & running (Docker Desktop on macOS).
# =============================================================================

REPO="Jackize/appDock"
IMAGE_DEFAULT="nguyenhao2042/appdock"

INSTALL_DIR="/opt/appdock-docker"
DATA_DIR_DEFAULT="/var/lib/appdock"
SERVICE_NAME="appdock"

# Defaults (override via env)
PORT="${APPDOCK_PORT:-8080}"
DATA_DIR="${APPDOCK_DATA_DIR_HOST:-$DATA_DIR_DEFAULT}"
IMAGE="${APPDOCK_IMAGE:-$IMAGE_DEFAULT}"
VERSION="${APPDOCK_VERSION:-latest}"

APPDOCK_USERNAME="${APPDOCK_USERNAME:-admin}"
APPDOCK_PASSWORD="${APPDOCK_PASSWORD:-appdock}"
APPDOCK_JWT_SECRET="${APPDOCK_JWT_SECRET:-}"
APPDOCK_AUTH_DISABLED="${APPDOCK_AUTH_DISABLED:-false}"
APPDOCK_SECURITY_SCAN_INTERVAL="${APPDOCK_SECURITY_SCAN_INTERVAL:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1" >&2; }
print_success() { echo -e "${GREEN}[OK]${NC} $1" >&2; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
print_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

is_linux() { [[ "$(uname -s | tr '[:upper:]' '[:lower:]')" == "linux" ]]; }

check_root_if_linux() {
  if is_linux && [[ $EUID -ne 0 ]]; then
    print_error "Run as root on Linux (use sudo)."
    exit 1
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    print_error "Missing required command: $cmd"
    exit 1
  fi
}

docker_running() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

require_docker() {
  if docker_running; then
    return 0
  fi

  if ! command -v docker >/dev/null 2>&1; then
    print_error "Docker is not installed."
    print_info "Install Docker first:"
    print_info "  - Linux: https://docs.docker.com/engine/install/"
    print_info "  - macOS: https://docs.docker.com/desktop/setup/install/mac-install/"
    exit 1
  fi

  print_error "Docker is installed but not running."
  if is_linux; then
    print_info "Start Docker and re-run:"
    print_info "  sudo systemctl start docker"
  else
    print_info "Start Docker Desktop and re-run."
  fi
  exit 1
}

ensure_jwt_secret() {
  if [[ "$APPDOCK_AUTH_DISABLED" == "true" ]]; then
    return 0
  fi
  if [[ -n "$APPDOCK_JWT_SECRET" ]]; then
    return 0
  fi

  if command -v openssl >/dev/null 2>&1; then
    APPDOCK_JWT_SECRET="$(openssl rand -hex 32)"
    export APPDOCK_JWT_SECRET
    return 0
  fi

  # fallback - still unique-ish; better than empty
  APPDOCK_JWT_SECRET="$(date +%s)-$RANDOM-$RANDOM"
  export APPDOCK_JWT_SECRET
}

has_docker_compose() {
  docker compose version >/dev/null 2>&1
}

write_compose_files() {
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$DATA_DIR"

  local env_file="${INSTALL_DIR}/appdock.env"
  local compose_file="${INSTALL_DIR}/docker-compose.yml"

  ensure_jwt_secret

  cat > "$env_file" <<EOF
PORT=${PORT}
GIN_MODE=release
APPDOCK_DATA_DIR=/data
APPDOCK_USERNAME=${APPDOCK_USERNAME}
APPDOCK_PASSWORD=${APPDOCK_PASSWORD}
APPDOCK_JWT_SECRET=${APPDOCK_JWT_SECRET}
APPDOCK_AUTH_DISABLED=${APPDOCK_AUTH_DISABLED}
EOF

  if [[ -n "$APPDOCK_SECURITY_SCAN_INTERVAL" ]]; then
    echo "APPDOCK_SECURITY_SCAN_INTERVAL=${APPDOCK_SECURITY_SCAN_INTERVAL}" >> "$env_file"
  fi
  if [[ -n "$GEMINI_API_KEY" ]]; then
    echo "GEMINI_API_KEY=${GEMINI_API_KEY}" >> "$env_file"
  fi

  cat > "$compose_file" <<EOF
version: "3.8"
services:
  appdock:
    image: ${IMAGE}:${VERSION}
    container_name: ${SERVICE_NAME}
    ports:
      - "${PORT}:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${DATA_DIR}:/data
    env_file:
      - ./appdock.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/api/auth/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
EOF

  print_success "Wrote ${compose_file}"
  print_success "Wrote ${env_file}"
}

do_install_or_upgrade() {
  require_docker
  if ! has_docker_compose; then
    print_error "Docker Compose plugin not found (need: docker compose)."
    print_info "Install the Docker Compose plugin, then re-run."
    exit 1
  fi

  write_compose_files

  print_info "Pulling image ${IMAGE}:${VERSION}..."
  docker compose -f "${INSTALL_DIR}/docker-compose.yml" pull

  print_info "Starting AppDock container..."
  docker compose -f "${INSTALL_DIR}/docker-compose.yml" up -d

  echo ""
  print_success "AppDock is running in Docker."
  print_info "Access UI: http://localhost:${PORT}"
  print_info "Install dir: ${INSTALL_DIR}"
  print_info "Data dir: ${DATA_DIR}"
  echo ""
  print_info "Manage:"
  print_info "  Logs:    docker logs -f ${SERVICE_NAME}"
  print_info "  Stop:    docker stop ${SERVICE_NAME}"
  print_info "  Start:   docker start ${SERVICE_NAME}"
  print_info "  Update:  docker compose -f ${INSTALL_DIR}/docker-compose.yml pull && docker compose -f ${INSTALL_DIR}/docker-compose.yml up -d"
}

do_uninstall() {
  require_docker
  if [[ -f "${INSTALL_DIR}/docker-compose.yml" ]] && has_docker_compose; then
    print_info "Stopping/removing container..."
    docker compose -f "${INSTALL_DIR}/docker-compose.yml" down --remove-orphans || true
  else
    if docker ps -a --format '{{.Names}}' | grep -qx "${SERVICE_NAME}"; then
      print_info "Removing container ${SERVICE_NAME}..."
      docker rm -f "${SERVICE_NAME}" >/dev/null 2>&1 || true
    fi
  fi

  if [[ -d "$INSTALL_DIR" ]]; then
    print_info "Removing ${INSTALL_DIR}..."
    rm -rf "$INSTALL_DIR"
  fi

  print_success "Uninstalled AppDock Docker setup."
  print_warning "Data directory preserved at: ${DATA_DIR}"
}

do_status() {
  if ! command -v docker >/dev/null 2>&1; then
    print_warning "Docker: not installed"
    return 0
  fi
  if docker info >/dev/null 2>&1; then
    print_success "Docker: running"
  else
    print_warning "Docker: installed but not running"
  fi

  if docker ps --format '{{.Names}}' | grep -qx "${SERVICE_NAME}"; then
    print_success "AppDock container: running (${SERVICE_NAME})"
    docker ps --filter "name=^/${SERVICE_NAME}$" --format '  Image: {{.Image}}  Ports: {{.Ports}}'
  else
    if docker ps -a --format '{{.Names}}' | grep -qx "${SERVICE_NAME}"; then
      print_warning "AppDock container: exists but not running (${SERVICE_NAME})"
    else
      print_warning "AppDock container: not installed"
    fi
  fi

  if [[ -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
    print_success "Compose file: ${INSTALL_DIR}/docker-compose.yml"
  else
    print_warning "Compose file: not found at ${INSTALL_DIR}/docker-compose.yml"
  fi
}

show_help() {
  cat <<EOF
AppDock Docker Installer

Usage: $0 [OPTIONS]

Options:
  --help, -h            Show help
  --version TAG         Docker image tag (default: latest)
  --port PORT           Host port to expose UI (default: 8080)
  --data-dir PATH       Host data dir to persist data (default: /var/lib/appdock)
  --image IMAGE         Docker image (default: ${IMAGE_DEFAULT})
  --uninstall           Stop/remove container and delete ${INSTALL_DIR} (keeps data dir)
  --status              Show status

Environment variables (optional):
  APPDOCK_PORT
  APPDOCK_DATA_DIR_HOST
  APPDOCK_IMAGE
  APPDOCK_VERSION
  APPDOCK_USERNAME
  APPDOCK_PASSWORD
  APPDOCK_JWT_SECRET
  APPDOCK_AUTH_DISABLED
  APPDOCK_SECURITY_SCAN_INTERVAL
  GEMINI_API_KEY

Examples:
  sudo $0
  sudo $0 --port 8081
  sudo $0 --version latest
  sudo $0 --data-dir /srv/appdock-data
  sudo $0 --uninstall
EOF
}

main() {
  check_root_if_linux
  require_cmd uname
  require_cmd grep
  require_cmd mkdir
  require_cmd rm

  local action="install"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help|-h) show_help; exit 0 ;;
      --uninstall) action="uninstall"; shift ;;
      --status) action="status"; shift ;;
      --version) VERSION="$2"; shift 2 ;;
      --port) PORT="$2"; shift 2 ;;
      --data-dir) DATA_DIR="$2"; shift 2 ;;
      --image) IMAGE="$2"; shift 2 ;;
      *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  case "$action" in
    install) do_install_or_upgrade ;;
    uninstall) do_uninstall ;;
    status) do_status ;;
  esac
}

main "$@"
