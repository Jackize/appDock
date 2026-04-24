package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"appdock/internal/models"
)

type TraefikStore struct {
	filePath string
	mu       sync.RWMutex
	cfg      *models.TraefikConfig
}

func NewTraefikStore(dataDir string) (*TraefikStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &TraefikStore{
		filePath: filepath.Join(dataDir, "traefik.json"),
	}
	if err := s.load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		now := time.Now()
		s.cfg = &models.TraefikConfig{
			Enabled:   false,
			CreatedAt: now,
			UpdatedAt: now,
		}
		_ = s.save()
	}
	return s, nil
}

func (s *TraefikStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var cfg models.TraefikConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}
	s.cfg = &cfg
	return nil
}

func (s *TraefikStore) save() error {
	b, err := json.MarshalIndent(s.cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, b, 0600)
}

func (s *TraefikStore) Get() models.TraefikConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.cfg == nil {
		return models.TraefikConfig{}
	}
	return *s.cfg
}

func (s *TraefikStore) Update(mut func(cfg *models.TraefikConfig)) (models.TraefikConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cfg == nil {
		now := time.Now()
		s.cfg = &models.TraefikConfig{Enabled: false, CreatedAt: now, UpdatedAt: now}
	}
	mut(s.cfg)
	s.cfg.UpdatedAt = time.Now()
	if err := s.save(); err != nil {
		return models.TraefikConfig{}, err
	}
	return *s.cfg, nil
}

