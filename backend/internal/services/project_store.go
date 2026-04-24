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
	ErrProjectNotFound = errors.New("project not found")
)

type ProjectStore struct {
	projects map[string]*models.Project
	filePath string
	mu       sync.RWMutex
}

func NewProjectStore(dataDir string) (*ProjectStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	store := &ProjectStore{
		projects: make(map[string]*models.Project),
		filePath: filepath.Join(dataDir, "projects.json"),
	}

	if err := store.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return store, nil
}

func (s *ProjectStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var list []*models.Project
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}

	s.projects = make(map[string]*models.Project)
	for _, p := range list {
		s.projects[p.ID] = p
	}
	return nil
}

func (s *ProjectStore) save() error {
	list := make([]*models.Project, 0, len(s.projects))
	for _, p := range s.projects {
		list = append(list, p)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *ProjectStore) List() []*models.Project {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Project, 0, len(s.projects))
	for _, p := range s.projects {
		out = append(out, p)
	}
	return out
}

func (s *ProjectStore) Get(id string) (*models.Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.projects[id]
	if !ok {
		return nil, ErrProjectNotFound
	}
	return p, nil
}

func (s *ProjectStore) Create(req models.CreateProjectRequest) (*models.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	names := normalizeComposeNames(req.ComposeProjectNames)
	p := models.NewProject(req.Name, req.Description, req.ServerID, names)
	p.RegistryProjectID = req.RegistryProjectID
	s.projects[p.ID] = p
	if err := s.save(); err != nil {
		delete(s.projects, p.ID)
		return nil, err
	}
	return p, nil
}

func (s *ProjectStore) Update(id string, req models.UpdateProjectRequest) (*models.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	p, ok := s.projects[id]
	if !ok {
		return nil, ErrProjectNotFound
	}

	if req.Name != "" {
		p.Name = req.Name
	}
	p.Description = req.Description
	if req.ServerID != "" {
		p.ServerID = req.ServerID
	}
	if req.ComposeProjectNames != nil {
		p.ComposeProjectNames = normalizeComposeNames(req.ComposeProjectNames)
	}
	if req.RegistryProjectID != nil {
		p.RegistryProjectID = *req.RegistryProjectID
	}
	p.UpdatedAt = time.Now()

	if err := s.save(); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[id]; !ok {
		return ErrProjectNotFound
	}
	delete(s.projects, id)
	return s.save()
}

func normalizeComposeNames(in []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(in))
	for _, n := range in {
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out
}
