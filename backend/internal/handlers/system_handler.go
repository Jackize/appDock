package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	serverManager       *services.ServerManager
	statsHistoryService *services.StatsHistoryService
	configStore         *services.ConfigStore
	authService         *services.AuthService
}

func NewSystemHandler(sm *services.ServerManager, shs *services.StatsHistoryService, cs *services.ConfigStore, auth *services.AuthService) *SystemHandler {
	return &SystemHandler{
		serverManager:       sm,
		statsHistoryService: shs,
		configStore:         cs,
		authService:         auth,
	}
}

func (h *SystemHandler) requireAdmin(c *gin.Context) bool {
	// If auth is disabled, allow (single-tenant mode).
	if h.authService == nil || !h.authService.IsAuthEnabled() {
		return true
	}
	v, ok := c.Get("claims")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return false
	}
	claims, ok := v.(*services.Claims)
	if !ok || claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return false
	}
	if !h.authService.IsAdminClaims(claims) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return false
	}
	return true
}

// GetSystemInfo returns Docker system info (or basic info if Docker is not available)
func (h *SystemHandler) GetSystemInfo(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)

	if h.serverManager.IsLocal(serverID) {
		info, err := h.serverManager.GetLocalDocker().GetSystemInfo()
		if err != nil {
			if errors.Is(err, services.ErrDockerNotConnected) {
				basicInfo := h.serverManager.GetLocalDocker().GetBasicSystemInfo()
				c.JSON(http.StatusOK, gin.H{
					"dockerAvailable": false,
					"info":            basicInfo,
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"dockerAvailable": true,
			"info":            info,
		})
		return
	}

	// For remote servers, return combined system stats
	stats, err := h.serverManager.GetSystemStats(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"dockerAvailable": true,
		"info":            stats,
	})
}

// GetDockerStatus returns Docker connection status
func (h *SystemHandler) GetDockerStatus(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)

	if h.serverManager.IsLocal(serverID) {
		c.JSON(http.StatusOK, gin.H{
			"connected": h.serverManager.GetLocalDocker().IsConnected(),
		})
		return
	}

	// For remote servers, test the connection
	err := h.serverManager.TestConnection(serverID)
	c.JSON(http.StatusOK, gin.H{
		"connected": err == nil,
	})
}

// GetSystemStats trả về thống kê hệ thống
func (h *SystemHandler) GetSystemStats(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	stats, err := h.serverManager.GetSystemStats(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetStatsHistory trả về lịch sử thống kê (only local server)
func (h *SystemHandler) GetStatsHistory(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if !h.serverManager.IsLocal(serverID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stats history only available for local server"})
		return
	}
	history := h.statsHistoryService.GetHistory()
	c.JSON(http.StatusOK, history)
}

type maskedValue struct {
	Configured bool   `json:"configured"`
	Masked     string `json:"masked"`
}

func maskIfSet(v string) maskedValue {
	v = strings.TrimSpace(v)
	if v == "" {
		return maskedValue{Configured: false, Masked: ""}
	}
	// Never return real secrets. Give a stable mask length hint.
	if len(v) <= 4 {
		return maskedValue{Configured: true, Masked: "****"}
	}
	return maskedValue{Configured: true, Masked: v[:2] + strings.Repeat("*", max(4, len(v)-4)) + v[len(v)-2:]}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// GetConfig returns runtime configuration (env-based), with secrets masked.
func (h *SystemHandler) GetConfig(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	// NOTE: This endpoint is behind AuthMiddleware (see router setup in main.go).
	cfg := services.AppConfig{}
	if h.configStore != nil {
		cfg = h.configStore.Get()
	}

	username := strings.TrimSpace(cfg.Username)
	if username == "" {
		username = strings.TrimSpace(os.Getenv("APPDOCK_USERNAME"))
	}
	if username == "" {
		username = "admin"
	}

	password := cfg.Password
	if strings.TrimSpace(password) == "" {
		password = os.Getenv("APPDOCK_PASSWORD")
	}
	if password == "" {
		password = "appdock"
	}

	emailProvider := strings.TrimSpace(cfg.EmailProvider)
	if emailProvider == "" {
		emailProvider = strings.TrimSpace(os.Getenv("APPDOCK_EMAIL_PROVIDER"))
	}
	if emailProvider == "" {
		emailProvider = "resend"
	}

	clientID := strings.TrimSpace(cfg.GoogleClientID)
	if clientID == "" {
		clientID = strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID"))
	}
	clientSecret := cfg.GoogleClientSecret
	if strings.TrimSpace(clientSecret) == "" {
		clientSecret = os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
	}

	resendAPIKey := strings.TrimSpace(cfg.ResendAPIKey)
	if resendAPIKey == "" {
		resendAPIKey = strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	}
	emailFrom := strings.TrimSpace(cfg.EmailFrom)
	if emailFrom == "" {
		emailFrom = strings.TrimSpace(os.Getenv("APPDOCK_EMAIL_FROM"))
	}

	authDisabled := false
	if cfg.AuthDisabled != nil {
		authDisabled = *cfg.AuthDisabled
	} else {
		authDisabled = strings.TrimSpace(os.Getenv("APPDOCK_AUTH_DISABLED")) == "true"
	}

	geminiKey := strings.TrimSpace(cfg.GeminiAPIKey)
	if geminiKey == "" {
		geminiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if geminiKey == "" {
		geminiKey = strings.TrimSpace(os.Getenv("GOOGLE_AI_API_KEY"))
	}
	geminiModel := strings.TrimSpace(cfg.GeminiModel)
	if geminiModel == "" {
		geminiModel = strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"username": username,
			"password": maskIfSet(password),
		},
		"auth": gin.H{
			"disabled": authDisabled,
			"jwtSecret": gin.H{
				// Do not expose APPDOCK_JWT_SECRET at all (only indicate if custom set).
				"configured": strings.TrimSpace(os.Getenv("APPDOCK_JWT_SECRET")) != "",
			},
		},
		"email": gin.H{
			"provider": emailProvider,
			"from":     strings.TrimSpace(emailFrom),
			"resend": gin.H{
				"apiKey": maskIfSet(resendAPIKey),
			},
		},
		"oauth": gin.H{
			"google": gin.H{
				"clientId":     clientID,
				"clientSecret": maskIfSet(clientSecret),
			},
		},
		"ai": gin.H{
			"gemini": gin.H{
				"apiKey": maskIfSet(geminiKey),
				"model":  geminiModel,
			},
		},
	})
}

type patchConfigRequest struct {
	User *struct {
		Username string `json:"username"`
		Password string `json:"password"`
	} `json:"user,omitempty"`
	Auth *struct {
		Disabled  *bool  `json:"disabled"`
		JWTSecret string `json:"jwtSecret"`
	} `json:"auth,omitempty"`
	Email *struct {
		Provider string `json:"provider"`
		From     string `json:"from"`
		Resend   *struct {
			APIKey string `json:"apiKey"`
		} `json:"resend,omitempty"`
	} `json:"email,omitempty"`
	OAuth *struct {
		Google *struct {
			ClientID     string `json:"clientId"`
			ClientSecret string `json:"clientSecret"`
		} `json:"google,omitempty"`
	} `json:"oauth,omitempty"`
	AI *struct {
		Gemini *struct {
			APIKey string `json:"apiKey"`
			Model  string `json:"model"`
		} `json:"gemini,omitempty"`
	} `json:"ai,omitempty"`
}

// PatchConfig persists configuration to APPDOCK_DATA_DIR/config.json.
func (h *SystemHandler) PatchConfig(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	if h.configStore == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Config store not available"})
		return
	}
	var req patchConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	patch := services.AppConfig{}
	if req.User != nil {
		patch.Username = req.User.Username
		if strings.TrimSpace(req.User.Password) != "" {
			patch.Password = req.User.Password
		}
	}
	if req.Auth != nil {
		patch.AuthDisabled = req.Auth.Disabled
		patch.JWTSecret = req.Auth.JWTSecret
	}
	if req.Email != nil {
		patch.EmailProvider = req.Email.Provider
		patch.EmailFrom = req.Email.From
		if req.Email.Resend != nil {
			patch.ResendAPIKey = req.Email.Resend.APIKey
		}
	}
	if req.OAuth != nil && req.OAuth.Google != nil {
		patch.GoogleClientID = req.OAuth.Google.ClientID
		if strings.TrimSpace(req.OAuth.Google.ClientSecret) != "" {
			patch.GoogleClientSecret = req.OAuth.Google.ClientSecret
		}
	}
	if req.AI != nil && req.AI.Gemini != nil {
		patch.GeminiModel = req.AI.Gemini.Model
		if strings.TrimSpace(req.AI.Gemini.APIKey) != "" {
			patch.GeminiAPIKey = req.AI.Gemini.APIKey
		}
	}

	if _, err := h.configStore.Patch(patch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return updated (masked) config via GetConfig logic
	h.GetConfig(c)
}

type configField struct {
	Key         string      `json:"key"` // env var key
	Label       string      `json:"label"`
	Type        string      `json:"type"` // "string" | "number" | "boolean" | "select" | "secret"
	Value       interface{} `json:"value,omitempty"`
	Configured  bool        `json:"configured"`
	Options     []string    `json:"options,omitempty"`
	Placeholder string      `json:"placeholder,omitempty"`
	Help        string      `json:"help,omitempty"`
}

type configTab struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	Fields      []configField `json:"fields"`
}

type configSchemaResponse struct {
	Tabs []configTab `json:"tabs"`
}

func getEnvInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func getEnvBool(key string, def bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return def
	}
	return v == "1" || v == "true" || v == "yes"
}

// GetConfigSchema returns Settings tabs + typed fields (admin-only).
// Values are resolved as: configStore -> env -> default.
// Sensitive values are never returned (only `configured` flag).
func (h *SystemHandler) GetConfigSchema(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	cfg := services.AppConfig{}
	if h.configStore != nil {
		cfg = h.configStore.Get()
	}

	// Resolve user/auth
	username := strings.TrimSpace(cfg.Username)
	if username == "" {
		username = strings.TrimSpace(os.Getenv("APPDOCK_USERNAME"))
	}
	if username == "" {
		username = "admin"
	}
	password := cfg.Password
	if strings.TrimSpace(password) == "" {
		password = os.Getenv("APPDOCK_PASSWORD")
	}
	passwordConfigured := strings.TrimSpace(password) != ""

	authDisabled := false
	if cfg.AuthDisabled != nil {
		authDisabled = *cfg.AuthDisabled
	} else {
		authDisabled = strings.TrimSpace(os.Getenv("APPDOCK_AUTH_DISABLED")) == "true"
	}

	jwtSecret := strings.TrimSpace(cfg.JWTSecret)
	if jwtSecret == "" {
		jwtSecret = strings.TrimSpace(os.Getenv("APPDOCK_JWT_SECRET"))
	}
	jwtConfigured := jwtSecret != ""

	// Security
	secScan := 300
	if cfg.SecurityScanIntervalSec != nil && *cfg.SecurityScanIntervalSec > 0 {
		secScan = *cfg.SecurityScanIntervalSec
	} else {
		secScan = getEnvInt("APPDOCK_SECURITY_SCAN_INTERVAL", 300)
	}
	minSev := strings.TrimSpace(cfg.SecurityReportMinSeverity)
	if minSev == "" {
		minSev = strings.TrimSpace(os.Getenv("APPDOCK_SECURITY_REPORT_MIN_SEVERITY"))
	}
	if minSev == "" {
		minSev = "medium"
	}
	cooldown := 600
	if cfg.SecurityAICooldownSec != nil && *cfg.SecurityAICooldownSec > 0 {
		cooldown = *cfg.SecurityAICooldownSec
	} else {
		cooldown = getEnvInt("APPDOCK_SECURITY_AI_COOLDOWN_SEC", 600)
	}
	aiEnabled := true
	if cfg.SecurityAIEnabled != nil {
		aiEnabled = *cfg.SecurityAIEnabled
	} else {
		aiEnabled = getEnvBool("APPDOCK_SECURITY_AI_ENABLED", true)
	}
	geminiModel := strings.TrimSpace(cfg.GeminiModel)
	if geminiModel == "" {
		geminiModel = strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	}
	if geminiModel == "" {
		geminiModel = "gemini-2.0-flash"
	}

	// OAuth
	publicURL := strings.TrimRight(strings.TrimSpace(cfg.PublicURL), "/")
	if publicURL == "" {
		publicURL = strings.TrimRight(strings.TrimSpace(os.Getenv("APPDOCK_PUBLIC_URL")), "/")
	}
	if publicURL == "" {
		// Keep empty; UI can show placeholder.
	}
	clientID := strings.TrimSpace(cfg.GoogleClientID)
	if clientID == "" {
		clientID = strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID"))
	}
	clientSecret := cfg.GoogleClientSecret
	if strings.TrimSpace(clientSecret) == "" {
		clientSecret = os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
	}
	clientSecretConfigured := strings.TrimSpace(clientSecret) != ""
	inviteTTL := 168
	if cfg.InviteTTLHours != nil && *cfg.InviteTTLHours > 0 {
		inviteTTL = *cfg.InviteTTLHours
	} else {
		inviteTTL = getEnvInt("APPDOCK_INVITE_TTL_HOURS", 168)
	}

	// Email
	emailProvider := strings.TrimSpace(cfg.EmailProvider)
	if emailProvider == "" {
		emailProvider = strings.TrimSpace(os.Getenv("APPDOCK_EMAIL_PROVIDER"))
	}
	if emailProvider == "" {
		emailProvider = "resend"
	}
	emailFrom := strings.TrimSpace(cfg.EmailFrom)
	if emailFrom == "" {
		emailFrom = strings.TrimSpace(os.Getenv("APPDOCK_EMAIL_FROM"))
	}
	resendKey := strings.TrimSpace(cfg.ResendAPIKey)
	if resendKey == "" {
		resendKey = strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	}
	resendConfigured := resendKey != ""

	passwordPH := "Not configured"
	if passwordConfigured {
		passwordPH = "Configured (enter to change)"
	}
	jwtPH := "Not configured"
	if jwtConfigured {
		jwtPH = "Configured (use regenerate to rotate)"
	}
	googleSecretPH := "Not configured"
	if clientSecretConfigured {
		googleSecretPH = "Configured (enter to change)"
	}
	resendPH := "Not configured"
	if resendConfigured {
		resendPH = "Configured (enter to change)"
	}

	out := configSchemaResponse{
		Tabs: []configTab{
			{
				ID:          "user",
				Title:       "User",
				Description: "Tài khoản admin + auth behavior",
				Fields: []configField{
					{Key: "APPDOCK_USERNAME", Label: "Email / Username (admin)", Type: "string", Value: username, Configured: username != ""},
					{Key: "APPDOCK_PASSWORD", Label: "Password (admin)", Type: "secret", Configured: passwordConfigured, Placeholder: passwordPH},
					{Key: "APPDOCK_AUTH_DISABLED", Label: "Disable authentication", Type: "boolean", Value: authDisabled, Configured: true},
					{Key: "APPDOCK_JWT_SECRET", Label: "JWT Secret", Type: "secret", Configured: jwtConfigured, Placeholder: jwtPH, Help: "Never exposed. Generate a strong secret and persist to config.json."},
				},
			},
			{
				ID:          "security",
				Title:       "Security",
				Description: "Background scan + AI settings",
				Fields: []configField{
					{Key: "GEMINI_MODEL", Label: "Gemini model", Type: "string", Value: geminiModel, Configured: geminiModel != ""},
					{Key: "APPDOCK_SECURITY_SCAN_INTERVAL", Label: "Scan interval (seconds)", Type: "number", Value: secScan, Configured: true},
					{Key: "APPDOCK_SECURITY_REPORT_MIN_SEVERITY", Label: "Min severity to persist", Type: "select", Value: minSev, Configured: true, Options: []string{"info", "low", "medium", "high", "critical"}},
					{Key: "APPDOCK_SECURITY_AI_COOLDOWN_SEC", Label: "AI cooldown (seconds)", Type: "number", Value: cooldown, Configured: true},
					{Key: "APPDOCK_SECURITY_AI_ENABLED", Label: "AI enabled", Type: "boolean", Value: aiEnabled, Configured: true},
				},
			},
			{
				ID:          "oauth",
				Title:       "OAuth",
				Description: "Public URL + Google OAuth + invite TTL",
				Fields: []configField{
					{Key: "APPDOCK_PUBLIC_URL", Label: "Public base URL", Type: "string", Value: publicURL, Configured: publicURL != "", Placeholder: "http://localhost:3000"},
					{Key: "GOOGLE_OAUTH_CLIENT_ID", Label: "Google OAuth client ID", Type: "string", Value: clientID, Configured: clientID != ""},
					{Key: "GOOGLE_OAUTH_CLIENT_SECRET", Label: "Google OAuth client secret", Type: "secret", Configured: clientSecretConfigured, Placeholder: googleSecretPH},
					{Key: "APPDOCK_INVITE_TTL_HOURS", Label: "Invite TTL (hours)", Type: "number", Value: inviteTTL, Configured: true},
				},
			},
			{
				ID:          "email",
				Title:       "Email",
				Description: "Provider + sender + API key",
				Fields: []configField{
					{Key: "APPDOCK_EMAIL_PROVIDER", Label: "Email provider", Type: "string", Value: emailProvider, Configured: emailProvider != "", Placeholder: "resend"},
					{Key: "APPDOCK_EMAIL_FROM", Label: "From", Type: "string", Value: emailFrom, Configured: emailFrom != "", Placeholder: "noreply@yourdomain"},
					{Key: "RESEND_API_KEY", Label: "Resend API key", Type: "secret", Configured: resendConfigured, Placeholder: resendPH},
				},
			},
		},
	}

	c.JSON(http.StatusOK, out)
}

type patchConfigValuesRequest struct {
	Values map[string]interface{} `json:"values"`
}

func toInt(v interface{}) (int, bool) {
	switch t := v.(type) {
	case float64:
		return int(t), true
	case int:
		return t, true
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(t))
		if err != nil {
			return 0, false
		}
		return n, true
	default:
		return 0, false
	}
}

func toBool(v interface{}) (bool, bool) {
	switch t := v.(type) {
	case bool:
		return t, true
	case string:
		s := strings.TrimSpace(strings.ToLower(t))
		if s == "" {
			return false, false
		}
		return s == "1" || s == "true" || s == "yes", true
	default:
		return false, false
	}
}

// PatchConfigValues updates config.json by env-key map (admin-only).
// Empty string values for secrets are ignored (so UI can submit blank to "keep existing").
func (h *SystemHandler) PatchConfigValues(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	if h.configStore == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Config store not available"})
		return
	}
	var req patchConfigValuesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	patch := services.AppConfig{}

	for k, v := range req.Values {
		switch k {
		case "APPDOCK_USERNAME":
			if s, ok := v.(string); ok {
				patch.Username = s
			}
		case "APPDOCK_PASSWORD":
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				patch.Password = s
			}
		case "APPDOCK_AUTH_DISABLED":
			if b, ok := toBool(v); ok {
				patch.AuthDisabled = &b
			}
		case "APPDOCK_JWT_SECRET":
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				patch.JWTSecret = s
			}
		case "GEMINI_MODEL":
			if s, ok := v.(string); ok {
				patch.GeminiModel = s
			}
		case "APPDOCK_SECURITY_SCAN_INTERVAL":
			if n, ok := toInt(v); ok && n > 0 {
				patch.SecurityScanIntervalSec = &n
			}
		case "APPDOCK_SECURITY_REPORT_MIN_SEVERITY":
			if s, ok := v.(string); ok {
				patch.SecurityReportMinSeverity = s
			}
		case "APPDOCK_SECURITY_AI_COOLDOWN_SEC":
			if n, ok := toInt(v); ok && n > 0 {
				patch.SecurityAICooldownSec = &n
			}
		case "APPDOCK_SECURITY_AI_ENABLED":
			if b, ok := toBool(v); ok {
				patch.SecurityAIEnabled = &b
			}
		case "APPDOCK_PUBLIC_URL":
			if s, ok := v.(string); ok {
				patch.PublicURL = s
			}
		case "GOOGLE_OAUTH_CLIENT_ID":
			if s, ok := v.(string); ok {
				patch.GoogleClientID = s
			}
		case "GOOGLE_OAUTH_CLIENT_SECRET":
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				patch.GoogleClientSecret = s
			}
		case "APPDOCK_INVITE_TTL_HOURS":
			if n, ok := toInt(v); ok && n > 0 {
				patch.InviteTTLHours = &n
			}
		case "APPDOCK_EMAIL_PROVIDER":
			if s, ok := v.(string); ok {
				patch.EmailProvider = s
			}
		case "APPDOCK_EMAIL_FROM":
			if s, ok := v.(string); ok {
				patch.EmailFrom = s
			}
		case "RESEND_API_KEY":
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				patch.ResendAPIKey = s
			}
		}
	}

	if _, err := h.configStore.Patch(patch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.GetConfigSchema(c)
}

// GenerateJWTSecret generates a strong secret and persists it to config.json (admin-only).
func (h *SystemHandler) GenerateJWTSecret(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	if h.configStore == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Config store not available"})
		return
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate secret"})
		return
	}
	secret := base64.RawURLEncoding.EncodeToString(b)
	if _, err := h.configStore.Patch(services.AppConfig{JWTSecret: secret}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"configured": true})
}
