package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// AppConfig is persisted to disk under APPDOCK_DATA_DIR (default: ./data).
// It provides durable configuration across restarts/updates.
//
// NOTE: Secrets are stored in plaintext in this file (similar to a .env file).
// Ensure the data directory is protected (permissions/volume).
type AppConfig struct {
	// Auth / user
	Username     string `json:"username,omitempty"`
	Password     string `json:"password,omitempty"`
	JWTSecret    string `json:"jwtSecret,omitempty"`
	AuthDisabled *bool  `json:"authDisabled,omitempty"`

	// Public base URL (used to build redirects/invite links)
	PublicURL string `json:"publicUrl,omitempty"`

	// Invites
	InviteTTLHours *int `json:"inviteTtlHours,omitempty"`

	// Email (Resend)
	EmailProvider string `json:"emailProvider,omitempty"` // e.g. "resend"
	EmailFrom     string `json:"emailFrom,omitempty"`
	ResendAPIKey  string `json:"resendApiKey,omitempty"`

	// OAuth (Google)
	GoogleClientID     string `json:"googleClientId,omitempty"`
	GoogleClientSecret string `json:"googleClientSecret,omitempty"`

	// AI (Gemini)
	GeminiAPIKey string `json:"geminiApiKey,omitempty"`
	GeminiModel  string `json:"geminiModel,omitempty"`

	// Security scanning / reports
	SecurityScanIntervalSec   *int   `json:"securityScanIntervalSec,omitempty"`
	SecurityReportMinSeverity string `json:"securityReportMinSeverity,omitempty"`
	SecurityAICooldownSec     *int   `json:"securityAiCooldownSec,omitempty"`
	SecurityAIEnabled         *bool  `json:"securityAiEnabled,omitempty"`
}

type ConfigStore struct {
	mu       sync.RWMutex
	filePath string
	cfg      AppConfig
}

func NewConfigStore(dataDir string) (*ConfigStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &ConfigStore{
		filePath: filepath.Join(dataDir, "config.json"),
		cfg:      AppConfig{},
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *ConfigStore) load() error {
	b, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var cfg AppConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		return err
	}
	s.cfg = cfg
	return nil
}

func (s *ConfigStore) saveLocked() error {
	b, err := json.MarshalIndent(s.cfg, "", "  ")
	if err != nil {
		return err
	}
	// Restrict file permissions because it may contain secrets.
	return os.WriteFile(s.filePath, b, 0600)
}

func (s *ConfigStore) Get() AppConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg
}

func (s *ConfigStore) Patch(patch AppConfig) (AppConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Trim + apply only when non-empty (for strings).
	if strings.TrimSpace(patch.Username) != "" {
		s.cfg.Username = strings.TrimSpace(patch.Username)
	}
	if patch.Password != "" {
		s.cfg.Password = patch.Password
	}
	if strings.TrimSpace(patch.JWTSecret) != "" {
		s.cfg.JWTSecret = strings.TrimSpace(patch.JWTSecret)
	}
	if patch.AuthDisabled != nil {
		s.cfg.AuthDisabled = patch.AuthDisabled
	}

	if strings.TrimSpace(patch.PublicURL) != "" {
		s.cfg.PublicURL = strings.TrimSpace(patch.PublicURL)
	}
	if patch.InviteTTLHours != nil && *patch.InviteTTLHours > 0 {
		s.cfg.InviteTTLHours = patch.InviteTTLHours
	}

	if strings.TrimSpace(patch.EmailProvider) != "" {
		s.cfg.EmailProvider = strings.TrimSpace(patch.EmailProvider)
	}
	if strings.TrimSpace(patch.EmailFrom) != "" {
		s.cfg.EmailFrom = strings.TrimSpace(patch.EmailFrom)
	}
	if strings.TrimSpace(patch.ResendAPIKey) != "" {
		s.cfg.ResendAPIKey = strings.TrimSpace(patch.ResendAPIKey)
	}

	if strings.TrimSpace(patch.GoogleClientID) != "" {
		s.cfg.GoogleClientID = strings.TrimSpace(patch.GoogleClientID)
	}
	if strings.TrimSpace(patch.GoogleClientSecret) != "" {
		s.cfg.GoogleClientSecret = patch.GoogleClientSecret
	}

	if strings.TrimSpace(patch.GeminiAPIKey) != "" {
		s.cfg.GeminiAPIKey = strings.TrimSpace(patch.GeminiAPIKey)
	}
	if strings.TrimSpace(patch.GeminiModel) != "" {
		s.cfg.GeminiModel = strings.TrimSpace(patch.GeminiModel)
	}

	if patch.SecurityScanIntervalSec != nil && *patch.SecurityScanIntervalSec > 0 {
		s.cfg.SecurityScanIntervalSec = patch.SecurityScanIntervalSec
	}
	if strings.TrimSpace(patch.SecurityReportMinSeverity) != "" {
		s.cfg.SecurityReportMinSeverity = strings.TrimSpace(patch.SecurityReportMinSeverity)
	}
	if patch.SecurityAICooldownSec != nil && *patch.SecurityAICooldownSec > 0 {
		s.cfg.SecurityAICooldownSec = patch.SecurityAICooldownSec
	}
	if patch.SecurityAIEnabled != nil {
		s.cfg.SecurityAIEnabled = patch.SecurityAIEnabled
	}

	if err := s.saveLocked(); err != nil {
		return AppConfig{}, err
	}
	return s.cfg, nil
}
