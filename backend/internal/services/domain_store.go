package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"appdock/internal/models"
)

var (
	ErrDomainNotFound      = errors.New("domain not found")
	ErrDomainAlreadyExists = errors.New("domain already exists")
)

type DomainStore struct {
	domains  map[string]*models.Domain
	filePath string
	mu       sync.RWMutex
}

func NewDomainStore(dataDir string) (*DomainStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	store := &DomainStore{
		domains:  make(map[string]*models.Domain),
		filePath: filepath.Join(dataDir, "domains.json"),
	}

	if err := store.load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
	}

	return store, nil
}

func (s *DomainStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var domains []*models.Domain
	if err := json.Unmarshal(data, &domains); err != nil {
		return err
	}

	s.domains = make(map[string]*models.Domain)
	for _, domain := range domains {
		s.domains[domain.ID] = domain
	}

	return nil
}

func (s *DomainStore) save() error {
	domains := make([]*models.Domain, 0, len(s.domains))
	for _, domain := range s.domains {
		domains = append(domains, domain)
	}

	data, err := json.MarshalIndent(domains, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0644)
}

func (s *DomainStore) List() []*models.Domain {
	s.mu.RLock()
	defer s.mu.RUnlock()

	domains := make([]*models.Domain, 0, len(s.domains))
	for _, domain := range s.domains {
		domains = append(domains, domain)
	}

	return domains
}

func (s *DomainStore) Get(id string) (*models.Domain, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	domain, exists := s.domains[id]
	if !exists {
		return nil, ErrDomainNotFound
	}

	return domain, nil
}

func (s *DomainStore) GetByDomain(domainName string) *models.Domain {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, domain := range s.domains {
		if domain.Domain == domainName {
			return domain
		}
	}

	return nil
}

func (s *DomainStore) Create(req models.CreateDomainRequest) (*models.Domain, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for duplicate domain name
	for _, d := range s.domains {
		if d.Domain == req.Domain {
			return nil, ErrDomainAlreadyExists
		}
	}

	now := time.Now()
	domain := &models.Domain{
		ID:           fmt.Sprintf("domain_%d", now.UnixNano()),
		Domain:       req.Domain,
		UpstreamHost: req.UpstreamHost,
		UpstreamPort: req.UpstreamPort,
		SSLEnabled:   false,
		SSLStatus:    models.SSLStatusNone,
		Enabled:      true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	s.domains[domain.ID] = domain

	if err := s.save(); err != nil {
		delete(s.domains, domain.ID)
		return nil, err
	}

	return domain, nil
}

func (s *DomainStore) Update(id string, req models.UpdateDomainRequest) (*models.Domain, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	domain, exists := s.domains[id]
	if !exists {
		return nil, ErrDomainNotFound
	}

	if req.UpstreamHost != nil {
		domain.UpstreamHost = *req.UpstreamHost
	}
	if req.UpstreamPort != nil {
		domain.UpstreamPort = *req.UpstreamPort
	}
	if req.Enabled != nil {
		domain.Enabled = *req.Enabled
	}

	domain.UpdatedAt = time.Now()

	if err := s.save(); err != nil {
		return nil, err
	}

	return domain, nil
}

func (s *DomainStore) UpdateSSL(id string, enabled bool, status models.SSLStatus, expiry *time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	domain, exists := s.domains[id]
	if !exists {
		return ErrDomainNotFound
	}

	domain.SSLEnabled = enabled
	domain.SSLStatus = status
	domain.SSLExpiry = expiry
	domain.UpdatedAt = time.Now()

	return s.save()
}

func (s *DomainStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	domain, exists := s.domains[id]
	if !exists {
		return ErrDomainNotFound
	}

	delete(s.domains, id)

	if err := s.save(); err != nil {
		s.domains[id] = domain
		return err
	}

	return nil
}
