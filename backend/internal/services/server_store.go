package services

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"appdock/internal/models"
)

var (
	ErrServerNotFound      = errors.New("server not found")
	ErrServerAlreadyExists = errors.New("server already exists")
	ErrCannotDeleteLocal   = errors.New("cannot delete local server")
)

type ServerStore struct {
	servers  map[string]*models.Server
	filePath string
	mu       sync.RWMutex
}

func NewServerStore(dataDir string) (*ServerStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	store := &ServerStore{
		servers:  make(map[string]*models.Server),
		filePath: filepath.Join(dataDir, "servers.json"),
	}

	if err := store.load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
	}

	// Ensure local server always exists
	if _, exists := store.servers["local"]; !exists {
		localServer := models.NewLocalServer()
		store.servers[localServer.ID] = localServer
		store.save()
	}

	return store, nil
}

func (s *ServerStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var servers []*models.Server
	if err := json.Unmarshal(data, &servers); err != nil {
		return err
	}

	s.servers = make(map[string]*models.Server)
	for _, server := range servers {
		s.servers[server.ID] = server
	}

	return nil
}

func (s *ServerStore) save() error {
	servers := make([]*models.Server, 0, len(s.servers))
	for _, server := range s.servers {
		servers = append(servers, server)
	}

	data, err := json.MarshalIndent(servers, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0644)
}

func (s *ServerStore) List() []*models.Server {
	s.mu.RLock()
	defer s.mu.RUnlock()

	servers := make([]*models.Server, 0, len(s.servers))
	for _, server := range s.servers {
		servers = append(servers, server)
	}

	return servers
}

func (s *ServerStore) Get(id string) (*models.Server, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	server, exists := s.servers[id]
	if !exists {
		return nil, ErrServerNotFound
	}

	return server, nil
}

func (s *ServerStore) Create(name, host, apiKey string) (*models.Server, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	server := models.NewServer(name, host, apiKey)
	s.servers[server.ID] = server

	if err := s.save(); err != nil {
		delete(s.servers, server.ID)
		return nil, err
	}

	return server, nil
}

func (s *ServerStore) Update(id string, req models.UpdateServerRequest) (*models.Server, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	server, exists := s.servers[id]
	if !exists {
		return nil, ErrServerNotFound
	}

	if req.Name != "" {
		server.Name = req.Name
	}
	if req.Host != "" && !server.IsLocal {
		server.Host = req.Host
	}
	if req.APIKey != "" && !server.IsLocal {
		server.APIKey = req.APIKey
	}

	// Handle default server change
	if req.IsDefault && !server.IsDefault {
		// Remove default from other servers
		for _, srv := range s.servers {
			srv.IsDefault = false
		}
		server.IsDefault = true
	}

	server.UpdatedAt = time.Now()

	if err := s.save(); err != nil {
		return nil, err
	}

	return server, nil
}

func (s *ServerStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	server, exists := s.servers[id]
	if !exists {
		return ErrServerNotFound
	}

	if server.IsLocal {
		return ErrCannotDeleteLocal
	}

	delete(s.servers, id)

	if err := s.save(); err != nil {
		s.servers[id] = server
		return err
	}

	return nil
}

func (s *ServerStore) UpdateStatus(id string, status models.ServerStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if server, exists := s.servers[id]; exists {
		server.Status = status
		server.UpdatedAt = time.Now()
		s.save()
	}
}

func (s *ServerStore) GetDefault() *models.Server {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, server := range s.servers {
		if server.IsDefault {
			return server
		}
	}

	// Fallback to local
	return s.servers["local"]
}
