package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== Models ====================

type SSLStatus string

const (
	SSLStatusNone    SSLStatus = "none"
	SSLStatusActive  SSLStatus = "active"
	SSLStatusExpired SSLStatus = "expired"
	SSLStatusPending SSLStatus = "pending"
)

type Domain struct {
	ID           string     `json:"id"`
	Domain       string     `json:"domain"`
	UpstreamHost string     `json:"upstreamHost"`
	UpstreamPort int        `json:"upstreamPort"`
	SSLEnabled   bool       `json:"sslEnabled"`
	SSLStatus    SSLStatus  `json:"sslStatus"`
	SSLExpiry    *time.Time `json:"sslExpiry,omitempty"`
	Enabled      bool       `json:"enabled"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type NginxStatusResponse struct {
	Installed        bool   `json:"installed"`
	Running          bool   `json:"running"`
	Version          string `json:"version"`
	ConfigOk         bool   `json:"configOk"`
	CertbotInstalled bool   `json:"certbotInstalled"`
}

type Certificate struct {
	Domain    string    `json:"domain"`
	Issuer    string    `json:"issuer"`
	ExpiresAt time.Time `json:"expiresAt"`
	Path      string    `json:"path"`
	KeyPath   string    `json:"keyPath"`
	AutoRenew bool      `json:"autoRenew"`
}

type CreateDomainRequest struct {
	Domain       string `json:"domain" binding:"required"`
	UpstreamHost string `json:"upstreamHost" binding:"required"`
	UpstreamPort int    `json:"upstreamPort" binding:"required,min=1,max=65535"`
	SSLEnabled   bool   `json:"sslEnabled"`
	SSLEmail     string `json:"sslEmail"`
}

type UpdateDomainRequest struct {
	UpstreamHost *string `json:"upstreamHost,omitempty"`
	UpstreamPort *int    `json:"upstreamPort,omitempty"`
	Enabled      *bool   `json:"enabled,omitempty"`
}

type RequestCertificateRequest struct {
	Domain string `json:"domain" binding:"required"`
	Email  string `json:"email" binding:"required"`
}

// ==================== Templates ====================

const httpConfigTmpl = `server {
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

const sslConfigTmpl = `server {
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
	httpTmplParsed = template.Must(template.New("http").Parse(httpConfigTmpl))
	sslTmplParsed  = template.Must(template.New("ssl").Parse(sslConfigTmpl))
)

const sitesAvailablePath = "/etc/nginx/sites-available"
const sitesEnabledPath = "/etc/nginx/sites-enabled"

// ==================== Handler ====================

type NginxHandler struct {
	domains    map[string]*Domain
	domainFile string
	pkgManager string
	mu         sync.RWMutex
}

func NewNginxHandler(dataDir string) *NginxHandler {
	h := &NginxHandler{
		domains:    make(map[string]*Domain),
		domainFile: filepath.Join(dataDir, "domains.json"),
	}
	h.detectPackageManager()
	h.loadDomains()
	return h
}

func (h *NginxHandler) detectPackageManager() {
	for _, mgr := range []string{"apt-get", "yum", "dnf", "apk"} {
		if _, err := exec.LookPath(mgr); err == nil {
			h.pkgManager = mgr
			return
		}
	}
	h.pkgManager = "apt-get"
}

func (h *NginxHandler) loadDomains() {
	data, err := os.ReadFile(h.domainFile)
	if err != nil {
		return
	}
	var domains []*Domain
	if json.Unmarshal(data, &domains) == nil {
		for _, d := range domains {
			h.domains[d.ID] = d
		}
	}
}

func (h *NginxHandler) saveDomains() error {
	domains := make([]*Domain, 0, len(h.domains))
	for _, d := range h.domains {
		domains = append(domains, d)
	}
	data, err := json.MarshalIndent(domains, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(h.domainFile)
	os.MkdirAll(dir, 0755)
	return os.WriteFile(h.domainFile, data, 0644)
}

func (h *NginxHandler) execCmd(timeout time.Duration, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// ==================== Nginx System Endpoints ====================

func (h *NginxHandler) GetStatus(c *gin.Context) {
	status := NginxStatusResponse{}

	// Check installed
	output, err := h.execCmd(10*time.Second, "nginx", "-v")
	status.Installed = err == nil
	if status.Installed {
		re := regexp.MustCompile(`nginx/(\S+)`)
		if m := re.FindStringSubmatch(output); len(m) > 1 {
			status.Version = m[1]
		}
	}

	// Check certbot
	_, cerr := exec.LookPath("certbot")
	status.CertbotInstalled = cerr == nil

	if !status.Installed {
		c.JSON(http.StatusOK, status)
		return
	}

	// Check running
	out, err := h.execCmd(10*time.Second, "systemctl", "is-active", "nginx")
	status.Running = err == nil && strings.TrimSpace(out) == "active"

	// Check config
	_, err = h.execCmd(10*time.Second, "nginx", "-t")
	status.ConfigOk = err == nil

	c.JSON(http.StatusOK, status)
}

func (h *NginxHandler) Install(c *gin.Context) {
	var cmd string
	var args []string
	switch h.pkgManager {
	case "apt-get":
		cmd, args = "apt-get", []string{"install", "-y", "nginx"}
	case "yum":
		cmd, args = "yum", []string{"install", "-y", "nginx"}
	case "dnf":
		cmd, args = "dnf", []string{"install", "-y", "nginx"}
	case "apk":
		cmd, args = "apk", []string{"add", "nginx"}
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unsupported package manager"})
		return
	}

	output, err := h.execCmd(5*time.Minute, cmd, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Install failed: %s\n%s", err, output)})
		return
	}

	os.MkdirAll(sitesAvailablePath, 0755)
	os.MkdirAll(sitesEnabledPath, 0755)
	h.execCmd(30*time.Second, "systemctl", "enable", "nginx")
	h.execCmd(30*time.Second, "systemctl", "start", "nginx")

	c.JSON(http.StatusOK, gin.H{"message": "Nginx installed successfully"})
}

func (h *NginxHandler) InstallCertbot(c *gin.Context) {
	var cmd string
	var args []string
	switch h.pkgManager {
	case "apt-get":
		cmd, args = "apt-get", []string{"install", "-y", "certbot", "python3-certbot-nginx"}
	case "yum", "dnf":
		cmd, args = h.pkgManager, []string{"install", "-y", "certbot", "python3-certbot-nginx"}
	case "apk":
		cmd, args = "apk", []string{"add", "certbot", "certbot-nginx"}
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unsupported package manager"})
		return
	}

	output, err := h.execCmd(5*time.Minute, cmd, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Install failed: %s\n%s", err, output)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Certbot installed successfully"})
}

func (h *NginxHandler) Start(c *gin.Context) {
	output, err := h.execCmd(30*time.Second, "systemctl", "start", "nginx")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Start failed: %s", output)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx started"})
}

func (h *NginxHandler) Stop(c *gin.Context) {
	output, err := h.execCmd(30*time.Second, "systemctl", "stop", "nginx")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Stop failed: %s", output)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx stopped"})
}

func (h *NginxHandler) Reload(c *gin.Context) {
	output, err := h.execCmd(30*time.Second, "nginx", "-s", "reload")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Reload failed: %s", output)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx reloaded"})
}

func (h *NginxHandler) TestConfig(c *gin.Context) {
	output, err := h.execCmd(10*time.Second, "nginx", "-t")
	c.JSON(http.StatusOK, gin.H{"valid": err == nil, "output": output})
}

// ==================== Domain Endpoints ====================

func (h *NginxHandler) ListDomains(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	domains := make([]*Domain, 0, len(h.domains))
	for _, d := range h.domains {
		domains = append(domains, d)
	}
	c.JSON(http.StatusOK, domains)
}

func (h *NginxHandler) GetDomain(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	id := c.Param("id")
	domain, ok := h.domains[id]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}
	c.JSON(http.StatusOK, domain)
}

func (h *NginxHandler) CreateDomain(c *gin.Context) {
	var req CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	domainRegex := regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)
	if !domainRegex.MatchString(req.Domain) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid domain name"})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Check duplicate
	for _, d := range h.domains {
		if d.Domain == req.Domain {
			c.JSON(http.StatusConflict, gin.H{"error": "Domain already exists"})
			return
		}
	}

	now := time.Now()
	domain := &Domain{
		ID:           fmt.Sprintf("domain_%d", now.UnixNano()),
		Domain:       req.Domain,
		UpstreamHost: req.UpstreamHost,
		UpstreamPort: req.UpstreamPort,
		SSLEnabled:   false,
		SSLStatus:    SSLStatusNone,
		Enabled:      true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Write nginx config
	if err := h.writeNginxConfig(domain); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to write config: %v", err)})
		return
	}

	// Create symlink
	if err := h.createSymlink(domain.Domain); err != nil {
		h.removeConfigFiles(domain.Domain)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to enable domain: %v", err)})
		return
	}

	// Test config
	output, err := h.execCmd(10*time.Second, "nginx", "-t")
	if err != nil {
		h.removeConfigFiles(domain.Domain)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Invalid nginx config: %s", output)})
		return
	}

	// Save to store
	h.domains[domain.ID] = domain
	if err := h.saveDomains(); err != nil {
		h.removeConfigFiles(domain.Domain)
		delete(h.domains, domain.ID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload nginx
	h.execCmd(30*time.Second, "nginx", "-s", "reload")

	// Handle SSL request
	if req.SSLEnabled && req.SSLEmail != "" {
		if sslErr := h.requestCertificate(domain, req.SSLEmail); sslErr != nil {
			c.JSON(http.StatusCreated, gin.H{"domain": domain, "sslWarning": sslErr.Error()})
			return
		}
		// Refresh domain after SSL
		domain = h.domains[domain.ID]
	}

	c.JSON(http.StatusCreated, domain)
}

func (h *NginxHandler) UpdateDomain(c *gin.Context) {
	id := c.Param("id")
	var req UpdateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	domain, ok := h.domains[id]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	if req.UpstreamHost != nil {
		domain.UpstreamHost = *req.UpstreamHost
	}
	if req.UpstreamPort != nil {
		domain.UpstreamPort = *req.UpstreamPort
	}
	if req.Enabled != nil {
		domain.Enabled = *req.Enabled
		if *req.Enabled {
			h.createSymlink(domain.Domain)
		} else {
			h.removeSymlink(domain.Domain)
		}
	}
	domain.UpdatedAt = time.Now()

	h.writeNginxConfig(domain)
	h.saveDomains()

	// Test and reload
	if _, err := h.execCmd(10*time.Second, "nginx", "-t"); err == nil {
		h.execCmd(30*time.Second, "nginx", "-s", "reload")
	}

	c.JSON(http.StatusOK, domain)
}

func (h *NginxHandler) DeleteDomain(c *gin.Context) {
	id := c.Param("id")

	h.mu.Lock()
	defer h.mu.Unlock()

	domain, ok := h.domains[id]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	h.removeConfigFiles(domain.Domain)
	delete(h.domains, id)
	h.saveDomains()
	h.execCmd(30*time.Second, "nginx", "-s", "reload")

	c.JSON(http.StatusOK, gin.H{"message": "Domain deleted"})
}

func (h *NginxHandler) EnableDomain(c *gin.Context) {
	id := c.Param("id")

	h.mu.Lock()
	defer h.mu.Unlock()

	domain, ok := h.domains[id]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	if err := h.createSymlink(domain.Domain); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	domain.Enabled = true
	domain.UpdatedAt = time.Now()
	h.saveDomains()
	h.execCmd(30*time.Second, "nginx", "-s", "reload")

	c.JSON(http.StatusOK, gin.H{"message": "Domain enabled"})
}

func (h *NginxHandler) DisableDomain(c *gin.Context) {
	id := c.Param("id")

	h.mu.Lock()
	defer h.mu.Unlock()

	domain, ok := h.domains[id]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	h.removeSymlink(domain.Domain)
	domain.Enabled = false
	domain.UpdatedAt = time.Now()
	h.saveDomains()
	h.execCmd(30*time.Second, "nginx", "-s", "reload")

	c.JSON(http.StatusOK, gin.H{"message": "Domain disabled"})
}

func (h *NginxHandler) GetDomainConfig(c *gin.Context) {
	id := c.Param("id")

	h.mu.RLock()
	defer h.mu.RUnlock()

	domain, ok := h.domains[id]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	configPath := filepath.Join(sitesAvailablePath, domain.Domain+".conf")
	data, err := os.ReadFile(configPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Cannot read config: %v", err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"config": string(data)})
}

// ==================== SSL Endpoints ====================

func (h *NginxHandler) ListCertificates(c *gin.Context) {
	if _, err := exec.LookPath("certbot"); err != nil {
		c.JSON(http.StatusOK, []*Certificate{})
		return
	}

	output, err := h.execCmd(30*time.Second, "certbot", "certificates")
	if err != nil {
		c.JSON(http.StatusOK, []*Certificate{})
		return
	}

	c.JSON(http.StatusOK, parseCertbotOutput(output))
}

func (h *NginxHandler) RequestCertificate(c *gin.Context) {
	var req RequestCertificateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Find domain
	var domain *Domain
	for _, d := range h.domains {
		if d.Domain == req.Domain {
			domain = d
			break
		}
	}
	if domain == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	if err := h.requestCertificate(domain, req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SSL certificate issued successfully"})
}

func (h *NginxHandler) RevokeCertificate(c *gin.Context) {
	domainName := c.Param("domain")

	h.mu.Lock()
	defer h.mu.Unlock()

	output, err := h.execCmd(2*time.Minute, "certbot", "revoke",
		"--cert-name", domainName, "--non-interactive", "--delete-after-revoke")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Revoke failed: %s\n%s", err, output)})
		return
	}

	// Update domain
	for _, d := range h.domains {
		if d.Domain == domainName {
			d.SSLEnabled = false
			d.SSLStatus = SSLStatusNone
			d.SSLExpiry = nil
			h.writeNginxConfig(d)
			h.saveDomains()
			h.execCmd(30*time.Second, "nginx", "-s", "reload")
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Certificate revoked"})
}

// ==================== Internal Helpers ====================

func (h *NginxHandler) requestCertificate(domain *Domain, email string) error {
	if !domain.Enabled {
		return fmt.Errorf("domain must be enabled before requesting SSL")
	}

	output, err := h.execCmd(5*time.Minute,
		"certbot", "certonly", "--nginx",
		"-d", domain.Domain,
		"--non-interactive", "--agree-tos", "-m", email)
	if err != nil {
		return fmt.Errorf("certbot failed: %s\n%s", err, output)
	}

	domain.SSLEnabled = true
	domain.SSLStatus = SSLStatusActive
	domain.SSLExpiry = getCertExpiry(domain.Domain)

	h.writeNginxConfig(domain)
	if _, err := h.execCmd(10*time.Second, "nginx", "-t"); err == nil {
		h.execCmd(30*time.Second, "nginx", "-s", "reload")
	}
	h.saveDomains()

	return nil
}

func (h *NginxHandler) writeNginxConfig(domain *Domain) error {
	configPath := filepath.Join(sitesAvailablePath, domain.Domain+".conf")

	tmpl := httpTmplParsed
	if domain.SSLEnabled {
		tmpl = sslTmplParsed
	}

	f, err := os.Create(configPath)
	if err != nil {
		return err
	}
	defer f.Close()
	return tmpl.Execute(f, domain)
}

func (h *NginxHandler) createSymlink(domainName string) error {
	src := filepath.Join(sitesAvailablePath, domainName+".conf")
	dst := filepath.Join(sitesEnabledPath, domainName+".conf")
	os.Remove(dst)
	return os.Symlink(src, dst)
}

func (h *NginxHandler) removeSymlink(domainName string) {
	os.Remove(filepath.Join(sitesEnabledPath, domainName+".conf"))
}

func (h *NginxHandler) removeConfigFiles(domainName string) {
	h.removeSymlink(domainName)
	os.Remove(filepath.Join(sitesAvailablePath, domainName+".conf"))
}

func getCertExpiry(domainName string) *time.Time {
	certPath := fmt.Sprintf("/etc/letsencrypt/live/%s/fullchain.pem", domainName)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil
	}
	parts := strings.SplitN(strings.TrimSpace(string(output)), "=", 2)
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

func parseCertbotOutput(output string) []*Certificate {
	var certs []*Certificate
	var current *Certificate

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if strings.HasPrefix(line, "Certificate Name:") {
			if current != nil {
				certs = append(certs, current)
			}
			current = &Certificate{
				Domain:    strings.TrimSpace(strings.TrimPrefix(line, "Certificate Name:")),
				Issuer:    "Let's Encrypt",
				AutoRenew: true,
			}
		}
		if current == nil {
			continue
		}
		if strings.HasPrefix(line, "Expiry Date:") {
			dateStr := strings.TrimSpace(strings.TrimPrefix(line, "Expiry Date:"))
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
	}
	if current != nil {
		certs = append(certs, current)
	}
	return certs
}
