package services

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"text/template"
	"time"

	"appdock/internal/models"
)

var (
	ErrNginxNotInstalled = fmt.Errorf("Nginx chưa được cài đặt")
	ErrNginxNotRunning   = fmt.Errorf("Nginx không đang chạy")
	ErrCertbotNotFound   = fmt.Errorf("Certbot chưa được cài đặt")
	ErrConfigInvalid     = fmt.Errorf("Cấu hình Nginx không hợp lệ")
	ErrPermissionDenied  = fmt.Errorf("Không có quyền thực thi lệnh hệ thống")
)

const sitesAvailablePath = "/etc/nginx/sites-available"
const sitesEnabledPath = "/etc/nginx/sites-enabled"

const httpConfigTemplate = `server {
    listen 80;
    server_name {{.Domain}};

    location / {
        proxy_pass http://{{.UpstreamHost}}:{{.UpstreamPort}};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`

const sslConfigTemplate = `server {
    listen 80;
    server_name {{.Domain}};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name {{.Domain}};

    ssl_certificate /etc/letsencrypt/live/{{.Domain}}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{.Domain}}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://{{.UpstreamHost}}:{{.UpstreamPort}};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`

var (
	httpTmpl *template.Template
	sslTmpl  *template.Template
)

func init() {
	httpTmpl = template.Must(template.New("http").Parse(httpConfigTemplate))
	sslTmpl = template.Must(template.New("ssl").Parse(sslConfigTemplate))
}

type NginxService struct {
	domainStore *DomainStore
	pkgManager  string // "apt-get", "yum", "dnf", "apk"
	mu          sync.RWMutex
}

func NewNginxService(dataDir string) (*NginxService, error) {
	domainStore, err := NewDomainStore(dataDir)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize domain store: %w", err)
	}

	ns := &NginxService{
		domainStore: domainStore,
	}
	ns.detectPackageManager()

	return ns, nil
}

func (n *NginxService) detectPackageManager() {
	managers := []string{"apt-get", "yum", "dnf", "apk"}
	for _, mgr := range managers {
		if _, err := exec.LookPath(mgr); err == nil {
			n.pkgManager = mgr
			return
		}
	}
	n.pkgManager = "apt-get" // fallback
}

func (n *NginxService) execCommand(timeout time.Duration, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// ==================== Nginx System ====================

func (n *NginxService) CheckInstalled() (bool, string) {
	output, err := n.execCommand(10*time.Second, "nginx", "-v")
	if err != nil {
		return false, ""
	}
	// nginx -v outputs to stderr: "nginx version: nginx/1.x.x"
	version := strings.TrimSpace(output)
	if version == "" {
		// Try stderr capture - nginx -v writes to stderr
		cmd := exec.Command("nginx", "-v")
		stderr, err := cmd.CombinedOutput()
		if err == nil {
			version = strings.TrimSpace(string(stderr))
		}
	}
	re := regexp.MustCompile(`nginx/(\S+)`)
	if matches := re.FindStringSubmatch(version); len(matches) > 1 {
		return true, matches[1]
	}
	return true, version
}

func (n *NginxService) CheckCertbotInstalled() bool {
	_, err := exec.LookPath("certbot")
	return err == nil
}

func (n *NginxService) GetStatus() (*models.NginxStatus, error) {
	installed, version := n.CheckInstalled()

	status := &models.NginxStatus{
		Installed:        installed,
		Version:          version,
		CertbotInstalled: n.CheckCertbotInstalled(),
	}

	if !installed {
		return status, nil
	}

	// Check if running
	output, err := n.execCommand(10*time.Second, "systemctl", "is-active", "nginx")
	status.Running = err == nil && strings.TrimSpace(output) == "active"

	// Check config validity
	_, err = n.execCommand(10*time.Second, "nginx", "-t")
	status.ConfigOk = err == nil

	return status, nil
}

func (n *NginxService) Install() error {
	installed, _ := n.CheckInstalled()
	if installed {
		return fmt.Errorf("Nginx đã được cài đặt")
	}

	var cmd string
	var args []string
	switch n.pkgManager {
	case "apt-get":
		cmd = "apt-get"
		args = []string{"install", "-y", "nginx"}
	case "yum":
		cmd = "yum"
		args = []string{"install", "-y", "nginx"}
	case "dnf":
		cmd = "dnf"
		args = []string{"install", "-y", "nginx"}
	case "apk":
		cmd = "apk"
		args = []string{"add", "nginx"}
	default:
		return fmt.Errorf("Không hỗ trợ package manager: %s", n.pkgManager)
	}

	output, err := n.execCommand(5*time.Minute, cmd, args...)
	if err != nil {
		return fmt.Errorf("Cài đặt Nginx thất bại: %s\n%s", err, output)
	}

	// Ensure sites-available and sites-enabled directories exist
	os.MkdirAll(sitesAvailablePath, 0755)
	os.MkdirAll(sitesEnabledPath, 0755)

	// Start and enable nginx
	n.execCommand(30*time.Second, "systemctl", "enable", "nginx")
	n.execCommand(30*time.Second, "systemctl", "start", "nginx")

	return nil
}

func (n *NginxService) InstallCertbot() error {
	if n.CheckCertbotInstalled() {
		return fmt.Errorf("Certbot đã được cài đặt")
	}

	var cmd string
	var args []string
	switch n.pkgManager {
	case "apt-get":
		cmd = "apt-get"
		args = []string{"install", "-y", "certbot", "python3-certbot-nginx"}
	case "yum", "dnf":
		cmd = n.pkgManager
		args = []string{"install", "-y", "certbot", "python3-certbot-nginx"}
	case "apk":
		cmd = "apk"
		args = []string{"add", "certbot", "certbot-nginx"}
	default:
		return fmt.Errorf("Không hỗ trợ package manager: %s", n.pkgManager)
	}

	output, err := n.execCommand(5*time.Minute, cmd, args...)
	if err != nil {
		return fmt.Errorf("Cài đặt Certbot thất bại: %s\n%s", err, output)
	}

	return nil
}

func (n *NginxService) Start() error {
	output, err := n.execCommand(30*time.Second, "systemctl", "start", "nginx")
	if err != nil {
		return fmt.Errorf("Không thể khởi động Nginx: %s\n%s", err, output)
	}
	return nil
}

func (n *NginxService) Stop() error {
	output, err := n.execCommand(30*time.Second, "systemctl", "stop", "nginx")
	if err != nil {
		return fmt.Errorf("Không thể dừng Nginx: %s\n%s", err, output)
	}
	return nil
}

func (n *NginxService) Reload() error {
	output, err := n.execCommand(30*time.Second, "nginx", "-s", "reload")
	if err != nil {
		return fmt.Errorf("Không thể reload Nginx: %s\n%s", err, output)
	}
	return nil
}

func (n *NginxService) TestConfig() (bool, string, error) {
	output, err := n.execCommand(10*time.Second, "nginx", "-t")
	if err != nil {
		return false, output, nil
	}
	return true, output, nil
}

// ==================== Domain Management ====================

func (n *NginxService) ListDomains() []*models.Domain {
	return n.domainStore.List()
}

func (n *NginxService) GetDomain(id string) (*models.Domain, error) {
	return n.domainStore.Get(id)
}

func (n *NginxService) CreateDomain(req models.CreateDomainRequest) (*models.Domain, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	// Validate domain format
	domainRegex := regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)
	if !domainRegex.MatchString(req.Domain) {
		return nil, fmt.Errorf("Tên domain không hợp lệ: %s", req.Domain)
	}

	// Create in store
	domain, err := n.domainStore.Create(req)
	if err != nil {
		return nil, err
	}

	// Generate and write nginx config
	if err := n.writeNginxConfig(domain); err != nil {
		// Rollback
		n.domainStore.Delete(domain.ID)
		return nil, fmt.Errorf("Không thể tạo cấu hình Nginx: %w", err)
	}

	// Create symlink to enable
	if err := n.createSymlink(domain.Domain); err != nil {
		// Rollback
		n.removeConfigFiles(domain.Domain)
		n.domainStore.Delete(domain.ID)
		return nil, fmt.Errorf("Không thể kích hoạt domain: %w", err)
	}

	// Test config
	valid, output, _ := n.TestConfig()
	if !valid {
		// Rollback
		n.removeConfigFiles(domain.Domain)
		n.domainStore.Delete(domain.ID)
		return nil, fmt.Errorf("Cấu hình Nginx không hợp lệ: %s", output)
	}

	// Reload nginx
	if err := n.Reload(); err != nil {
		// Config is valid but reload failed - don't rollback, just warn
		fmt.Printf("Warning: Nginx reload failed: %v\n", err)
	}

	return domain, nil
}

func (n *NginxService) UpdateDomain(id string, req models.UpdateDomainRequest) (*models.Domain, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	domain, err := n.domainStore.Update(id, req)
	if err != nil {
		return nil, err
	}

	// Regenerate config
	if err := n.writeNginxConfig(domain); err != nil {
		return nil, fmt.Errorf("Không thể cập nhật cấu hình Nginx: %w", err)
	}

	// Handle enable/disable
	if req.Enabled != nil {
		if *req.Enabled {
			n.createSymlink(domain.Domain)
		} else {
			n.removeSymlink(domain.Domain)
		}
	}

	// Test and reload
	valid, output, _ := n.TestConfig()
	if !valid {
		return nil, fmt.Errorf("Cấu hình Nginx không hợp lệ sau khi cập nhật: %s", output)
	}

	n.Reload()

	return domain, nil
}

func (n *NginxService) DeleteDomain(id string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	domain, err := n.domainStore.Get(id)
	if err != nil {
		return err
	}

	// Remove config files
	n.removeConfigFiles(domain.Domain)

	// Remove from store
	if err := n.domainStore.Delete(id); err != nil {
		return err
	}

	// Reload nginx
	n.Reload()

	return nil
}

func (n *NginxService) EnableDomain(id string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	domain, err := n.domainStore.Get(id)
	if err != nil {
		return err
	}

	if err := n.createSymlink(domain.Domain); err != nil {
		return fmt.Errorf("Không thể kích hoạt domain: %w", err)
	}

	enabled := true
	n.domainStore.Update(id, models.UpdateDomainRequest{Enabled: &enabled})

	n.Reload()
	return nil
}

func (n *NginxService) DisableDomain(id string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	domain, err := n.domainStore.Get(id)
	if err != nil {
		return err
	}

	n.removeSymlink(domain.Domain)

	disabled := false
	n.domainStore.Update(id, models.UpdateDomainRequest{Enabled: &disabled})

	n.Reload()
	return nil
}

func (n *NginxService) GetDomainConfig(id string) (string, error) {
	domain, err := n.domainStore.Get(id)
	if err != nil {
		return "", err
	}

	configPath := filepath.Join(sitesAvailablePath, domain.Domain+".conf")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", fmt.Errorf("Không thể đọc cấu hình: %w", err)
	}

	return string(data), nil
}

// ==================== SSL / Certificate Management ====================

func (n *NginxService) ListCertificates() ([]*models.Certificate, error) {
	if !n.CheckCertbotInstalled() {
		return []*models.Certificate{}, nil
	}

	output, err := n.execCommand(30*time.Second, "certbot", "certificates")
	if err != nil {
		return []*models.Certificate{}, nil
	}

	return n.parseCertbotOutput(output), nil
}

func (n *NginxService) RequestCertificate(domainName string, email string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	// Find domain in store
	domain := n.domainStore.GetByDomain(domainName)
	if domain == nil {
		return ErrDomainNotFound
	}

	if !domain.Enabled {
		return fmt.Errorf("Domain phải được kích hoạt trước khi yêu cầu SSL")
	}

	// Install certbot if needed
	if !n.CheckCertbotInstalled() {
		if err := n.InstallCertbot(); err != nil {
			return err
		}
	}

	// Request certificate
	output, err := n.execCommand(5*time.Minute,
		"certbot", "certonly", "--nginx",
		"-d", domainName,
		"--non-interactive",
		"--agree-tos",
		"-m", email,
	)
	if err != nil {
		return fmt.Errorf("Yêu cầu chứng chỉ SSL thất bại: %s\n%s", err, output)
	}

	// Regenerate config with SSL
	domain.SSLEnabled = true
	if err := n.writeNginxConfig(domain); err != nil {
		return fmt.Errorf("Không thể cập nhật cấu hình SSL: %w", err)
	}

	// Test and reload
	valid, testOutput, _ := n.TestConfig()
	if !valid {
		return fmt.Errorf("Cấu hình SSL không hợp lệ: %s", testOutput)
	}
	n.Reload()

	// Update domain SSL status
	expiry := n.getCertExpiry(domainName)
	n.domainStore.UpdateSSL(domain.ID, true, models.SSLStatusActive, expiry)

	return nil
}

func (n *NginxService) RevokeCertificate(domainName string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if !n.CheckCertbotInstalled() {
		return ErrCertbotNotFound
	}

	output, err := n.execCommand(2*time.Minute,
		"certbot", "revoke",
		"--cert-name", domainName,
		"--non-interactive",
		"--delete-after-revoke",
	)
	if err != nil {
		return fmt.Errorf("Thu hồi chứng chỉ thất bại: %s\n%s", err, output)
	}

	// Update domain to remove SSL
	domain := n.domainStore.GetByDomain(domainName)
	if domain != nil {
		domain.SSLEnabled = false
		n.writeNginxConfig(domain)
		n.domainStore.UpdateSSL(domain.ID, false, models.SSLStatusNone, nil)
		n.Reload()
	}

	return nil
}

// ==================== Internal Helpers ====================

func (n *NginxService) configFileName(domainName string) string {
	return domainName + ".conf"
}

func (n *NginxService) writeNginxConfig(domain *models.Domain) error {
	configPath := filepath.Join(sitesAvailablePath, n.configFileName(domain.Domain))

	var tmpl *template.Template
	if domain.SSLEnabled {
		tmpl = sslTmpl
	} else {
		tmpl = httpTmpl
	}

	f, err := os.Create(configPath)
	if err != nil {
		return err
	}
	defer f.Close()

	return tmpl.Execute(f, domain)
}

func (n *NginxService) createSymlink(domainName string) error {
	src := filepath.Join(sitesAvailablePath, n.configFileName(domainName))
	dst := filepath.Join(sitesEnabledPath, n.configFileName(domainName))

	// Remove existing symlink if any
	os.Remove(dst)

	return os.Symlink(src, dst)
}

func (n *NginxService) removeSymlink(domainName string) {
	dst := filepath.Join(sitesEnabledPath, n.configFileName(domainName))
	os.Remove(dst)
}

func (n *NginxService) removeConfigFiles(domainName string) {
	n.removeSymlink(domainName)
	configPath := filepath.Join(sitesAvailablePath, n.configFileName(domainName))
	os.Remove(configPath)
}

func (n *NginxService) getCertExpiry(domainName string) *time.Time {
	certPath := fmt.Sprintf("/etc/letsencrypt/live/%s/fullchain.pem", domainName)
	output, err := n.execCommand(10*time.Second,
		"openssl", "x509", "-enddate", "-noout", "-in", certPath,
	)
	if err != nil {
		return nil
	}

	// Parse "notAfter=Mon DD HH:MM:SS YYYY GMT"
	parts := strings.SplitN(strings.TrimSpace(output), "=", 2)
	if len(parts) != 2 {
		return nil
	}

	t, err := time.Parse("Jan  2 15:04:05 2006 GMT", parts[1])
	if err != nil {
		t, err = time.Parse("Jan 2 15:04:05 2006 GMT", parts[1])
		if err != nil {
			return nil
		}
	}

	return &t
}

func (n *NginxService) parseCertbotOutput(output string) []*models.Certificate {
	var certs []*models.Certificate
	var current *models.Certificate

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if strings.HasPrefix(line, "Certificate Name:") {
			if current != nil {
				certs = append(certs, current)
			}
			current = &models.Certificate{
				Domain:    strings.TrimSpace(strings.TrimPrefix(line, "Certificate Name:")),
				AutoRenew: true,
			}
		}

		if current == nil {
			continue
		}

		if strings.HasPrefix(line, "Expiry Date:") {
			dateStr := strings.TrimSpace(strings.TrimPrefix(line, "Expiry Date:"))
			// Remove the "(VALID: ...)" part
			if idx := strings.Index(dateStr, "("); idx > 0 {
				dateStr = strings.TrimSpace(dateStr[:idx])
			}
			if t, err := time.Parse("2006-01-02 15:04:05+00:00", dateStr); err == nil {
				current.ExpiresAt = t
			}
		}

		if strings.HasPrefix(line, "Certificate Path:") {
			current.Path = strings.TrimSpace(strings.TrimPrefix(line, "Certificate Path:"))
		}

		if strings.HasPrefix(line, "Private Key Path:") {
			current.KeyPath = strings.TrimSpace(strings.TrimPrefix(line, "Private Key Path:"))
		}

		if strings.Contains(line, "Domains:") {
			current.Issuer = "Let's Encrypt"
		}
	}

	if current != nil {
		certs = append(certs, current)
	}

	return certs
}
