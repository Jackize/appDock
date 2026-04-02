#!/bin/bash
set -e

# =============================================================================
# AppDock Installer
# Installs, upgrades, or uninstalls AppDock
# Usage: curl -fsSL https://raw.githubusercontent.com/Jackize/appDock/main/install.sh | bash
#        or: ./install.sh [--uninstall] [--version <tag>]
# =============================================================================

REPO="Jackize/appDock"
INSTALL_DIR="/opt/appdock"
DATA_DIR="/var/lib/appdock"
BINARY_NAME="appdock"
SERVICE_NAME="appdock"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Default configuration (can be overridden by environment variables)
PORT="${APPDOCK_PORT:-8080}"
AUTH_DISABLED="${APPDOCK_AUTH_DISABLED:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() { echo -e "${BLUE}[INFO]${NC} $1" >&2; }
print_success() { echo -e "${GREEN}[OK]${NC} $1" >&2; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
print_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# =============================================================================
# Helper Functions
# =============================================================================

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_dependencies() {
    local missing=()
    
    for cmd in curl grep; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        print_error "Missing required commands: ${missing[*]}"
        print_info "Please install them and try again"
        exit 1
    fi
}

# Check if Docker is installed and running
check_docker() {
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            return 0  # Docker installed and running
        else
            return 1  # Docker installed but not running
        fi
    else
        return 2  # Docker not installed
    fi
}

# Prompt user to install Docker
prompt_install_docker() {
    echo ""
    print_warning "Docker is not installed on this system."
    print_info "AppDock can still run and show system stats (CPU, RAM, Disk),"
    print_info "but Docker management features will be unavailable until Docker is installed."
    echo ""
    
    # Check if running interactively
    if [[ -t 0 ]]; then
        read -p "Would you like to install Docker now? [y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker
            return $?
        fi
    else
        print_info "Running non-interactively. Skipping Docker installation."
        print_info "To install Docker later, run:"
        print_info "  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install-docker.sh | sudo bash"
    fi
    
    return 1  # Docker not installed
}

# Download and run Docker installer
install_docker() {
    print_info "Downloading Docker installer..."
    local docker_installer="/tmp/install-docker.sh"
    
    if ! curl -fsSL -o "$docker_installer" "https://raw.githubusercontent.com/${REPO}/main/install-docker.sh"; then
        print_error "Failed to download Docker installer"
        print_info "You can install Docker manually: https://docs.docker.com/engine/install/"
        return 1
    fi
    
    chmod +x "$docker_installer"
    
    print_info "Running Docker installer..."
    if bash "$docker_installer"; then
        rm -f "$docker_installer"
        print_success "Docker installed successfully!"
        return 0
    else
        rm -f "$docker_installer"
        print_error "Docker installation failed"
        print_info "You can try installing Docker manually: https://docs.docker.com/engine/install/"
        return 1
    fi
}

detect_os() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$OS" in
        linux)  OS="linux" ;;
        darwin) OS="darwin" ;;
        *)
            print_error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
}

detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64)   ARCH="amd64" ;;
        aarch64|arm64)  ARCH="arm64" ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
}

get_latest_version() {
    local latest
    latest=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | head -1 | cut -d'"' -f4)
    
    if [[ -z "$latest" ]]; then
        print_error "Failed to fetch latest version from GitHub"
        exit 1
    fi
    
    echo "$latest"
}

get_installed_version() {
    if [[ -f "${INSTALL_DIR}/${BINARY_NAME}" ]]; then
        # Try to get version from binary, fallback to "unknown"
        local version
        version=$("${INSTALL_DIR}/${BINARY_NAME}" --version 2>/dev/null || echo "unknown")
        echo "$version"
    else
        echo ""
    fi
}

download_binary() {
    local version="$1"
    local binary_name="appdock-${OS}-${ARCH}"
    local download_url="https://github.com/${REPO}/releases/download/${version}/${binary_name}"
    local tmp_file="/tmp/${binary_name}"
    
    print_info "Downloading AppDock ${version} for ${OS}/${ARCH}..."
    
    if ! curl -fsSL -o "$tmp_file" "$download_url"; then
        print_error "Failed to download from: $download_url"
        exit 1
    fi
    
    chmod +x "$tmp_file"
    echo "$tmp_file"
}

# =============================================================================
# Installation Functions
# =============================================================================

stop_service() {
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        print_info "Stopping existing AppDock service..."
        systemctl stop "$SERVICE_NAME"
        print_success "Service stopped"
    fi
}

start_service() {
    print_info "Starting AppDock service..."
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"
    print_success "Service started and enabled"
}

backup_binary() {
    if [[ -f "${INSTALL_DIR}/${BINARY_NAME}" ]]; then
        local backup_name="${BINARY_NAME}.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backing up existing binary to ${backup_name}..."
        cp "${INSTALL_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${backup_name}"
    fi
}

install_binary() {
    local tmp_file="$1"
    
    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR"
    
    # Install binary
    print_info "Installing binary to ${INSTALL_DIR}/${BINARY_NAME}..."
    mv "$tmp_file" "${INSTALL_DIR}/${BINARY_NAME}"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    
    print_success "Binary installed"
}

create_systemd_service() {
    local docker_available="$1"
    print_info "Creating systemd service..."
    
    # Use Wants instead of Requires so service can start without Docker
    local docker_unit=""
    if [[ "$docker_available" == "true" ]]; then
        docker_unit="Wants=docker.service
After=network.target docker.service"
    else
        docker_unit="After=network.target"
    fi
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=AppDock - Docker Management UI
Documentation=https://github.com/${REPO}
${docker_unit}

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/${BINARY_NAME}
Restart=on-failure
RestartSec=5

# Environment
Environment=PORT=${PORT}
Environment=GIN_MODE=release
Environment=APPDOCK_DATA_DIR=${DATA_DIR}
Environment=APPDOCK_AUTH_DISABLED=${AUTH_DISABLED}

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}

# Docker socket access (if docker group exists)
SupplementaryGroups=docker

[Install]
WantedBy=multi-user.target
EOF
    
    print_success "Systemd service created at ${SERVICE_FILE}"
}

# =============================================================================
# Main Operations
# =============================================================================

do_install() {
    local version="$1"
    local is_upgrade=false
    local docker_available=false
    
    print_info "=========================================="
    print_info "AppDock Installer"
    print_info "=========================================="
    
    check_root
    check_dependencies
    detect_os
    detect_arch
    
    # Check for macOS - systemd not available
    if [[ "$OS" == "darwin" ]]; then
        print_warning "macOS detected. Systemd service will not be created."
        print_info "You can run AppDock manually or create a launchd service."
    fi
    
    # Check Docker status (Linux only)
    if [[ "$OS" == "linux" ]]; then
        check_docker
        local docker_status=$?
        
        case $docker_status in
            0)
                print_success "Docker is installed and running"
                docker_available=true
                ;;
            1)
                print_warning "Docker is installed but not running"
                print_info "Start Docker with: sudo systemctl start docker"
                docker_available=true
                ;;
            2)
                prompt_install_docker
                if check_docker; then
                    docker_available=true
                else
                    docker_available=false
                    print_warning "Continuing installation without Docker..."
                fi
                ;;
        esac
    fi
    
    # Get version to install
    if [[ -z "$version" ]]; then
        version=$(get_latest_version)
    fi
    print_info "Target version: ${version}"
    
    # Check if already installed
    if [[ -f "${INSTALL_DIR}/${BINARY_NAME}" ]]; then
        is_upgrade=true
        print_info "Existing installation detected - upgrading..."
        
        # Stop service for Linux
        if [[ "$OS" == "linux" ]]; then
            stop_service
        fi
        
        backup_binary
    fi
    
    # Download and install
    local tmp_file
    tmp_file=$(download_binary "$version")
    install_binary "$tmp_file"
    
    # Setup systemd service for Linux
    if [[ "$OS" == "linux" ]]; then
        create_systemd_service "$docker_available"
        start_service
        
        echo ""
        print_success "=========================================="
        if $is_upgrade; then
            print_success "AppDock upgraded successfully!"
        else
            print_success "AppDock installed successfully!"
        fi
        print_success "=========================================="
        echo ""
        print_info "Service status: systemctl status ${SERVICE_NAME}"
        print_info "View logs:      journalctl -u ${SERVICE_NAME} -f"
        print_info "Access UI:      http://localhost:${PORT}"
        print_info "Data directory: ${DATA_DIR}"
        
        if [[ "$docker_available" == "false" ]]; then
            echo ""
            print_warning "Docker is not installed. Some features will be unavailable."
            print_info "To install Docker later, run:"
            print_info "  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install-docker.sh | sudo bash"
            print_info "Then restart AppDock: sudo systemctl restart ${SERVICE_NAME}"
        fi
        echo ""
    else
        echo ""
        print_success "=========================================="
        print_success "AppDock binary installed successfully!"
        print_success "=========================================="
        echo ""
        print_info "Binary location: ${INSTALL_DIR}/${BINARY_NAME}"
        print_info "Run manually:    ${INSTALL_DIR}/${BINARY_NAME}"
        print_info "Data directory:  ${DATA_DIR}"
        echo ""
    fi
}

do_uninstall() {
    print_info "=========================================="
    print_info "AppDock Uninstaller"
    print_info "=========================================="
    
    check_root
    detect_os
    
    # Stop and disable service
    if [[ "$OS" == "linux" ]]; then
        if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            print_info "Stopping service..."
            systemctl stop "$SERVICE_NAME"
        fi
        
        if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
            print_info "Disabling service..."
            systemctl disable "$SERVICE_NAME"
        fi
        
        if [[ -f "$SERVICE_FILE" ]]; then
            print_info "Removing systemd service file..."
            rm -f "$SERVICE_FILE"
            systemctl daemon-reload
        fi
    fi
    
    # Remove binary and install directory
    if [[ -d "$INSTALL_DIR" ]]; then
        print_info "Removing ${INSTALL_DIR}..."
        rm -rf "$INSTALL_DIR"
    fi
    
    # Ask about data directory
    if [[ -d "$DATA_DIR" ]]; then
        echo ""
        read -p "Remove data directory ${DATA_DIR}? [y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Removing ${DATA_DIR}..."
            rm -rf "$DATA_DIR"
        else
            print_info "Data directory preserved at ${DATA_DIR}"
        fi
    fi
    
    echo ""
    print_success "AppDock uninstalled successfully!"
}

do_status() {
    print_info "=========================================="
    print_info "AppDock Status"
    print_info "=========================================="
    
    detect_os
    
    # Check binary
    if [[ -f "${INSTALL_DIR}/${BINARY_NAME}" ]]; then
        print_success "Binary: ${INSTALL_DIR}/${BINARY_NAME}"
    else
        print_warning "Binary: Not installed"
    fi
    
    # Check data directory
    if [[ -d "$DATA_DIR" ]]; then
        print_success "Data directory: ${DATA_DIR}"
    else
        print_warning "Data directory: Not created"
    fi
    
    # Check Docker status
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null 2>&1; then
            print_success "Docker: Installed and running"
        else
            print_warning "Docker: Installed but not running"
        fi
    else
        print_warning "Docker: Not installed"
        print_info "  Install with: curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install-docker.sh | sudo bash"
    fi
    
    # Check service (Linux only)
    if [[ "$OS" == "linux" ]]; then
        if [[ -f "$SERVICE_FILE" ]]; then
            print_success "Service file: ${SERVICE_FILE}"
        else
            print_warning "Service file: Not created"
        fi
        
        if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            print_success "Service status: Running"
        else
            print_warning "Service status: Not running"
        fi
    fi
    
    # Check latest version
    local latest
    latest=$(get_latest_version 2>/dev/null || echo "unknown")
    print_info "Latest version: ${latest}"
}

# =============================================================================
# Entry Point
# =============================================================================

show_help() {
    cat << EOF
AppDock Installer

Usage: $0 [OPTIONS]

Options:
    --help, -h          Show this help message
    --uninstall         Uninstall AppDock
    --status            Show installation status
    --version, -v TAG   Install specific version (default: latest)
    --install-docker    Install Docker only (without AppDock)

Environment Variables:
    APPDOCK_PORT            Port to listen on (default: 8080)
    APPDOCK_AUTH_DISABLED   Disable authentication (default: false)

Examples:
    # Install latest version (will prompt to install Docker if not found)
    sudo ./install.sh

    # Install specific version
    sudo ./install.sh --version v1.0.0

    # Install Docker only
    sudo ./install.sh --install-docker

    # Upgrade to latest
    sudo ./install.sh

    # Uninstall
    sudo ./install.sh --uninstall

    # Check status
    ./install.sh --status

    # One-liner install from GitHub
    curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sudo bash

Note:
    AppDock can run without Docker installed. System monitoring (CPU, RAM, Disk)
    will work, but Docker management features will be unavailable.
    You can install Docker later and restart AppDock to enable all features.
EOF
}

main() {
    local action="install"
    local version=""
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help|-h)
                show_help
                exit 0
                ;;
            --uninstall)
                action="uninstall"
                shift
                ;;
            --status)
                action="status"
                shift
                ;;
            --install-docker)
                action="install-docker"
                shift
                ;;
            --version|-v)
                version="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    case "$action" in
        install)        do_install "$version" ;;
        uninstall)      do_uninstall ;;
        status)         do_status ;;
        install-docker) 
            check_root
            install_docker
            ;;
    esac
}

main "$@"
