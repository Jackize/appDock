#!/bin/bash
set -e

# =============================================================================
# Docker Installer Script
# Installs Docker Engine on Linux (Ubuntu/Debian, CentOS/RHEL/Fedora)
# =============================================================================

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

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS="centos"
    else
        OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    fi
    echo "$OS"
}

# Install Docker on Ubuntu/Debian
install_docker_debian() {
    print_info "Installing Docker on Debian/Ubuntu..."
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install prerequisites
    apt-get update
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$1/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Set up repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$1 \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    print_success "Docker installed successfully"
}

# Install Docker on CentOS/RHEL/Fedora
install_docker_rhel() {
    print_info "Installing Docker on CentOS/RHEL/Fedora..."
    
    # Remove old versions
    yum remove -y docker docker-client docker-client-latest docker-common \
        docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
    
    # Install prerequisites
    yum install -y yum-utils
    
    # Add Docker repository
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    
    # Install Docker Engine
    yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    print_success "Docker installed successfully"
}

# Start and enable Docker
start_docker() {
    print_info "Starting Docker service..."
    systemctl start docker
    systemctl enable docker
    print_success "Docker service started and enabled"
}

# Add current user to docker group (optional)
setup_docker_group() {
    if [ -n "$SUDO_USER" ]; then
        print_info "Adding user '$SUDO_USER' to docker group..."
        usermod -aG docker "$SUDO_USER"
        print_success "User added to docker group (logout/login required to take effect)"
    fi
}

# Verify installation
verify_docker() {
    print_info "Verifying Docker installation..."
    if docker --version > /dev/null 2>&1; then
        print_success "Docker version: $(docker --version)"
        return 0
    else
        print_error "Docker installation verification failed"
        return 1
    fi
}

# Main installation
main() {
    print_info "=========================================="
    print_info "Docker Installer"
    print_info "=========================================="
    
    # Check root
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    OS=$(detect_os)
    print_info "Detected OS: $OS"
    
    case "$OS" in
        ubuntu)
            install_docker_debian "ubuntu"
            ;;
        debian)
            install_docker_debian "debian"
            ;;
        centos|rhel|rocky|almalinux)
            install_docker_rhel
            ;;
        fedora)
            install_docker_rhel
            ;;
        *)
            print_error "Unsupported OS: $OS"
            print_info "Please install Docker manually: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac
    
    start_docker
    setup_docker_group
    verify_docker
    
    echo ""
    print_success "=========================================="
    print_success "Docker installed successfully!"
    print_success "=========================================="
    echo ""
}

main "$@"
