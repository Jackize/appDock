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

var ErrComposeStackNotFound = errors.New("compose stack not found")

type ComposeStackStore struct {
	items    map[string]*models.ComposeStack
	filePath string
	mu       sync.RWMutex
}

func NewComposeStackStore(dataDir string) (*ComposeStackStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &ComposeStackStore{
		items:    make(map[string]*models.ComposeStack),
		filePath: filepath.Join(dataDir, "compose_stacks.json"),
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *ComposeStackStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var list []*models.ComposeStack
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}
	s.items = make(map[string]*models.ComposeStack)
	for _, it := range list {
		s.items[it.ID] = it
	}
	return nil
}

func (s *ComposeStackStore) save() error {
	list := make([]*models.ComposeStack, 0, len(s.items))
	for _, it := range s.items {
		list = append(list, it)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *ComposeStackStore) ListByProject(projectID string) []*models.ComposeStack {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.ComposeStack, 0)
	for _, it := range s.items {
		if it.ProjectID == projectID {
			out = append(out, it)
		}
	}
	return out
}

func (s *ComposeStackStore) Get(id string) (*models.ComposeStack, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	it, ok := s.items[id]
	if !ok {
		return nil, ErrComposeStackNotFound
	}
	return it, nil
}

func (s *ComposeStackStore) Create(req models.CreateComposeStackRequest) (*models.ComposeStack, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := models.NewComposeStack(req)
	s.items[st.ID] = st
	if err := s.save(); err != nil {
		delete(s.items, st.ID)
		return nil, err
	}
	return st, nil
}

func (s *ComposeStackStore) Update(id string, req models.UpdateComposeStackRequest) (*models.ComposeStack, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st, ok := s.items[id]
	if !ok {
		return nil, ErrComposeStackNotFound
	}
	st.Name = req.Name
	st.ComposeProjectName = req.ComposeProjectName
	st.ComposeYAML = req.ComposeYAML
	st.EnvContent = req.EnvContent
	if req.ServerID != "" {
		st.ServerID = req.ServerID
	}
	st.UpdatedAt = time.Now()
	if err := s.save(); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *ComposeStackStore) SetDeployMeta(id string, msg string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	st, exists := s.items[id]
	if !exists {
		return ErrComposeStackNotFound
	}
	now := time.Now()
	st.LastDeployAt = &now
	st.LastDeployMessage = msg
	st.UpdatedAt = now
	return s.save()
}

func (s *ComposeStackStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[id]; !ok {
		return ErrComposeStackNotFound
	}
	delete(s.items, id)
	return s.save()
}
