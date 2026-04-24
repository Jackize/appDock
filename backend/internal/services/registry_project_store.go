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

var ErrRegistryProjectNotFound = errors.New("registry project not found")

type RegistryProjectStore struct {
	items    map[string]*models.RegistryProject
	filePath string
	mu       sync.RWMutex
}

func NewRegistryProjectStore(dataDir string) (*RegistryProjectStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &RegistryProjectStore{
		items:    make(map[string]*models.RegistryProject),
		filePath: filepath.Join(dataDir, "registry_projects.json"),
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *RegistryProjectStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var list []*models.RegistryProject
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}
	s.items = make(map[string]*models.RegistryProject)
	for _, it := range list {
		s.items[it.ID] = it
	}
	return nil
}

func (s *RegistryProjectStore) save() error {
	list := make([]*models.RegistryProject, 0, len(s.items))
	for _, it := range s.items {
		list = append(list, it)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0600)
}

func (s *RegistryProjectStore) List() []*models.RegistryProject {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.RegistryProject, 0, len(s.items))
	for _, it := range s.items {
		out = append(out, it)
	}
	return out
}

func (s *RegistryProjectStore) Get(id string) (*models.RegistryProject, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	it, ok := s.items[id]
	if !ok {
		return nil, ErrRegistryProjectNotFound
	}
	return it, nil
}

func (s *RegistryProjectStore) Create(req models.CreateRegistryProjectRequest) (*models.RegistryProject, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := models.NewRegistryProject(req)
	s.items[p.ID] = p
	if err := s.save(); err != nil {
		delete(s.items, p.ID)
		return nil, err
	}
	return p, nil
}

func (s *RegistryProjectStore) Update(id string, req models.UpdateRegistryProjectRequest) (*models.RegistryProject, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.items[id]
	if !ok {
		return nil, ErrRegistryProjectNotFound
	}
	if req.Name != "" {
		p.Name = req.Name
	}
	p.Description = req.Description
	if req.Host != "" {
		p.Host = req.Host
	}
	if req.Namespace != "" || req.Host != "" {
		p.Namespace = req.Namespace
	}
	if req.Username != "" {
		p.Username = req.Username
	}
	if req.Password != "" {
		p.Password = req.Password
	}
	p.UpdatedAt = time.Now()
	if err := s.save(); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *RegistryProjectStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[id]; !ok {
		return ErrRegistryProjectNotFound
	}
	delete(s.items, id)
	return s.save()
}
