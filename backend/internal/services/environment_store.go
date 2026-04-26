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

var ErrEnvironmentNotFound = errors.New("environment not found")

type EnvironmentStore struct {
	items    map[string]*models.Environment
	filePath string
	mu       sync.RWMutex
}

func NewEnvironmentStore(dataDir string) (*EnvironmentStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &EnvironmentStore{
		items:    make(map[string]*models.Environment),
		filePath: filepath.Join(dataDir, "environments.json"),
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *EnvironmentStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var list []*models.Environment
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}
	s.items = make(map[string]*models.Environment)
	for _, it := range list {
		if it.Slug == "" {
			it.Slug = Slugify(it.Name)
		}
		s.items[it.ID] = it
	}
	return nil
}

func (s *EnvironmentStore) save() error {
	list := make([]*models.Environment, 0, len(s.items))
	for _, it := range s.items {
		list = append(list, it)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *EnvironmentStore) ListByProject(projectID string) []*models.Environment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Environment, 0)
	for _, it := range s.items {
		if it.ProjectID == projectID {
			cp := *it
			out = append(out, &cp)
		}
	}
	return out
}

func (s *EnvironmentStore) Get(id string) (*models.Environment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	it, ok := s.items[id]
	if !ok {
		return nil, ErrEnvironmentNotFound
	}
	cp := *it
	return &cp, nil
}

func (s *EnvironmentStore) Create(project *models.Project, req models.CreateEnvironmentRequest, workspace *WorkspaceService) (*models.Environment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	name := req.Name
	slug := Slugify(name)
	serverID := req.ServerID
	if serverID == "" {
		serverID = project.ServerID
	}
	if serverID == "" {
		serverID = "local"
	}
	networkName := "appdock_" + ShortID(project.ID) + "_" + Identifier(slug)
	workDir := workspace.EnvironmentDir(project, slug)
	env := models.NewEnvironment(project.ID, name, req.Description, serverID, slug, networkName, workDir)
	s.items[env.ID] = env
	if err := s.save(); err != nil {
		delete(s.items, env.ID)
		return nil, err
	}
	if err := workspace.EnsureEnvironment(project, env); err != nil {
		return nil, err
	}
	cp := *env
	return &cp, nil
}

func (s *EnvironmentStore) EnsureDefault(project *models.Project, workspace *WorkspaceService) (*models.Environment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, it := range s.items {
		if it.ProjectID == project.ID {
			if it.WorkDir == "" {
				it.WorkDir = workspace.EnvironmentDir(project, it.Slug)
				it.UpdatedAt = time.Now()
				_ = s.save()
			}
			_ = workspace.EnsureEnvironment(project, it)
			cp := *it
			return &cp, nil
		}
	}
	slug := "production"
	networkName := "appdock_" + ShortID(project.ID) + "_" + Identifier(slug)
	workDir := workspace.EnvironmentDir(project, slug)
	env := models.NewEnvironment(project.ID, "Production", "", project.ServerID, slug, networkName, workDir)
	s.items[env.ID] = env
	if err := s.save(); err != nil {
		delete(s.items, env.ID)
		return nil, err
	}
	if err := workspace.EnsureEnvironment(project, env); err != nil {
		return nil, err
	}
	cp := *env
	return &cp, nil
}

func (s *EnvironmentStore) DeleteByProject(projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, it := range s.items {
		if it.ProjectID == projectID {
			delete(s.items, id)
		}
	}
	return s.save()
}

func (s *EnvironmentStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[id]; !ok {
		return ErrEnvironmentNotFound
	}
	delete(s.items, id)
	return s.save()
}
