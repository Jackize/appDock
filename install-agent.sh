#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Default values
REPO="Jackize/appDock"
INSTALL_DIR="/opt/appdock-agent"
SERVICE_NAME="appdock-agent"
DEFAULT_PORT="9090"
VERSION=""

# Functions
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           🚀 AppDock Agent Installer                      ║"
    echo "║           Lightweight monitoring agent for remote servers ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

detect_os() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    case "$ARCH" in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac

    case "$OS" in
        linux)
            OS="linux"
            ;;
        darwin)
            OS="darwin"
            ;;
        *)
            log_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac

    BINARY_NAME="appdock-agent-${OS}-${ARCH}"
    log_info "Detected OS: ${OS}, Architecture: ${ARCH}"
}

get_latest_version() {
    if [[ -z "$VERSION" ]]; then
        log_info "Fetching latest version..."
        VERSION=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
        if [[ -z "$VERSION" ]]; then
            log_error "Failed to get latest version"
            exit 1
        fi
    fi
    log_info "Version: ${VERSION}"
}

generate_api_key() {
    API_KEY=$(openssl rand -hex 32)
    log_info "Generated API key"
}

download_binary() {
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}"
    TMP_FILE="${INSTALL_DIR}/.appdock-agent.download.$$"
    FINAL_BIN="${INSTALL_DIR}/appdock-agent"

    log_info "Downloading ${BINARY_NAME}..."

    mkdir -p "$INSTALL_DIR"

    # Download to a temp file then rename. Writing directly over the running
    # binary path fails with ETXTBSY / curl (23) when appdock-agent is active.
    if ! curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE"; then
        rm -f "$TMP_FILE"
        log_error "Failed to download binary from ${DOWNLOAD_URL}"
        exit 1
    fi

    chmod +x "$TMP_FILE"
    mv -f "$TMP_FILE" "$FINAL_BIN"
    log_success "Binary downloaded to ${FINAL_BIN}"
}

create_config() {
    CONFIG_FILE="${INSTALL_DIR}/agent.env"
    
    cat > "$CONFIG_FILE" << EOF
# AppDock Agent Configuration
# Generated on $(date)

# API Key for authentication (keep this secret!)
AGENT_API_KEY=${API_KEY}

# Port to listen on
AGENT_PORT=${PORT}

# Docker socket path
AGENT_DOCKER_SOCKET=/var/run/docker.sock
EOF
    
    chmod 600 "$CONFIG_FILE"
    log_success "Configuration saved to ${CONFIG_FILE}"
}

create_systemd_service() {
    if [[ "$OS" != "linux" ]]; then
        log_warning "Systemd service is only supported on Linux"
        return
    fi

    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=AppDock Agent - Remote monitoring agent
Documentation=https://github.com/${REPO}
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
EnvironmentFile=${INSTALL_DIR}/agent.env
ExecStart=${INSTALL_DIR}/appdock-agent --api-key=\${AGENT_API_KEY} --port=\${AGENT_PORT} --docker-socket=\${AGENT_DOCKER_SOCKET}
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=false
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/run/docker.sock

[Install]
WantedBy=multi-user.target
EOF
    
    log_info "Reloading systemd..."
    systemctl daemon-reload
    
    log_info "Enabling ${SERVICE_NAME} service..."
    systemctl enable "$SERVICE_NAME"
    
    log_info "Starting ${SERVICE_NAME} service..."
    # Use restart so reinstalls pick up a newly replaced binary (start is a no-op if already running).
    systemctl restart "$SERVICE_NAME"

    log_success "Systemd service created and started"
}

create_launchd_plist() {
    if [[ "$OS" != "darwin" ]]; then
        return
    fi

    PLIST_FILE="/Library/LaunchDaemons/com.appdock.agent.plist"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.appdock.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>${INSTALL_DIR}/appdock-agent</string>
        <string>--api-key=${API_KEY}</string>
        <string>--port=${PORT}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/appdock-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/appdock-agent.error.log</string>
</dict>
</plist>
EOF
    
    launchctl load "$PLIST_FILE"
    log_success "LaunchDaemon created and loaded"
}

show_status() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           ✅ AppDock Agent Installation Complete!         ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Installation Details:${NC}"
    echo -e "  Install Path:    ${CYAN}${INSTALL_DIR}${NC}"
    echo -e "  Config File:     ${CYAN}${INSTALL_DIR}/agent.env${NC}"
    echo -e "  Port:            ${CYAN}${PORT}${NC}"
    echo ""
    echo -e "${BOLD}${YELLOW}⚠️  IMPORTANT - Save your API Key:${NC}"
    echo ""
    echo -e "  ${RED}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "  ${RED}║${NC} ${BOLD}API Key:${NC} ${CYAN}${API_KEY}${NC} ${RED}║${NC}"
    echo -e "  ${RED}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${YELLOW}You will need this API key to add this server in AppDock UI.${NC}"
    echo -e "  ${YELLOW}Keep it secure and do not share it publicly!${NC}"
    echo ""
    
    if [[ "$OS" == "linux" ]]; then
        echo -e "${BOLD}Service Management:${NC}"
        echo -e "  Status:   ${CYAN}systemctl status ${SERVICE_NAME}${NC}"
        echo -e "  Logs:     ${CYAN}journalctl -u ${SERVICE_NAME} -f${NC}"
        echo -e "  Restart:  ${CYAN}sudo systemctl restart ${SERVICE_NAME}${NC}"
        echo -e "  Stop:     ${CYAN}sudo systemctl stop ${SERVICE_NAME}${NC}"
        echo ""
    fi
    
    echo -e "${BOLD}Add to AppDock:${NC}"
    echo -e "  1. Go to AppDock UI → Servers page"
    echo -e "  2. Click 'Add Server'"
    echo -e "  3. Enter:"
    echo -e "     - Name: ${CYAN}$(hostname)${NC}"
    echo -e "     - Host: ${CYAN}http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<server-ip>"):${PORT}${NC}"
    echo -e "     - API Key: ${CYAN}<paste the API key above>${NC}"
    echo ""
}

uninstall() {
    log_info "Uninstalling AppDock Agent..."
    
    if [[ "$OS" == "linux" ]]; then
        if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            log_info "Stopping service..."
            systemctl stop "$SERVICE_NAME"
        fi
        if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
            log_info "Disabling service..."
            systemctl disable "$SERVICE_NAME"
        fi
        if [[ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]; then
            rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
            systemctl daemon-reload
        fi
    elif [[ "$OS" == "darwin" ]]; then
        if [[ -f "/Library/LaunchDaemons/com.appdock.agent.plist" ]]; then
            launchctl unload "/Library/LaunchDaemons/com.appdock.agent.plist" 2>/dev/null || true
            rm -f "/Library/LaunchDaemons/com.appdock.agent.plist"
        fi
    fi
    
    if [[ -d "$INSTALL_DIR" ]]; then
        rm -rf "$INSTALL_DIR"
    fi
    
    log_success "AppDock Agent uninstalled successfully"
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --version VERSION    Install specific version (e.g., v1.0.0)"
    echo "  --port PORT          Set agent port (default: 9090)"
    echo "  --api-key KEY        Use specific API key instead of auto-generating"
    echo "  --uninstall          Uninstall AppDock Agent"
    echo "  --status             Show current installation status"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  sudo $0                           # Install latest version"
    echo "  sudo $0 --version v1.0.0          # Install specific version"
    echo "  sudo $0 --port 8090               # Install with custom port"
    echo "  sudo $0 --uninstall               # Uninstall"
}

show_current_status() {
    echo -e "${BOLD}AppDock Agent Status:${NC}"
    echo ""
    
    if [[ -f "${INSTALL_DIR}/appdock-agent" ]]; then
        echo -e "  Installed: ${GREEN}Yes${NC}"
        echo -e "  Path:      ${CYAN}${INSTALL_DIR}${NC}"
        
        if [[ -f "${INSTALL_DIR}/agent.env" ]]; then
            source "${INSTALL_DIR}/agent.env"
            echo -e "  Port:      ${CYAN}${AGENT_PORT:-N/A}${NC}"
            echo -e "  API Key:   ${CYAN}${AGENT_API_KEY:0:8}...${NC} (truncated)"
        fi
    else
        echo -e "  Installed: ${RED}No${NC}"
    fi
    
    echo ""
    
    if [[ "$OS" == "linux" ]]; then
        if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            echo -e "  Service:   ${GREEN}Running${NC}"
        else
            echo -e "  Service:   ${RED}Not running${NC}"
        fi
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --port)
            DEFAULT_PORT="$2"
            shift 2
            ;;
        --api-key)
            API_KEY="$2"
            shift 2
            ;;
        --uninstall)
            check_root
            detect_os
            uninstall
            exit 0
            ;;
        --status)
            detect_os
            show_current_status
            exit 0
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main installation
print_banner
check_root
detect_os
get_latest_version

# Set port
PORT="${DEFAULT_PORT}"

# Generate API key if not provided
if [[ -z "$API_KEY" ]]; then
    generate_api_key
fi

download_binary
create_config

# Create service based on OS
if [[ "$OS" == "linux" ]]; then
    create_systemd_service
elif [[ "$OS" == "darwin" ]]; then
    create_launchd_plist
fi

show_status
