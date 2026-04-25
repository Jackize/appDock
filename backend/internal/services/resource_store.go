package services

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"appdock/internal/models"
)

var ErrResourceNotFound = errors.New("resource not found")

type ResourceStore struct {
	items    map[string]*models.Resource
	filePath string
	mu       sync.RWMutex
}

func NewResourceStore(dataDir string) (*ResourceStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &ResourceStore{
		items:    make(map[string]*models.Resource),
		filePath: filepath.Join(dataDir, "resources.json"),
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *ResourceStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var list []*models.Resource
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}
	s.items = make(map[string]*models.Resource)
	for _, it := range list {
		if it.Slug == "" {
			it.Slug = Slugify(it.Name)
		}
		if it.Status == "" {
			it.Status = models.ResourceStatusIdle
		}
		s.items[it.ID] = it
	}
	return nil
}

func (s *ResourceStore) save() error {
	list := make([]*models.Resource, 0, len(s.items))
	for _, it := range s.items {
		list = append(list, it)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *ResourceStore) ListByEnvironment(environmentID string) []*models.Resource {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Resource, 0)
	for _, it := range s.items {
		if it.EnvironmentID == environmentID {
			cp := *it
			out = append(out, &cp)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		a := strings.ToLower(out[i].Name)
		b := strings.ToLower(out[j].Name)
		if a != b {
			return a < b
		}
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		}
		return out[i].ID < out[j].ID
	})
	return out
}

func (s *ResourceStore) Get(id string) (*models.Resource, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	it, ok := s.items[id]
	if !ok {
		return nil, ErrResourceNotFound
	}
	cp := *it
	return &cp, nil
}

func (s *ResourceStore) Create(project *models.Project, env *models.Environment, req models.CreateResourceRequest, workspace *WorkspaceService) (*models.Resource, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	slug := Slugify(req.Name)
	composeProject := "ad_" + ShortID(project.ID) + "_" + Identifier(env.Slug) + "_" + Identifier(slug)
	stub := models.NewResource(project.ID, env.ID, env.ServerID, req.Name, slug, composeProject, "", req)
	stub.WorkDir = workspace.ResourceDir(project, env, stub.ID, slug)
	s.normalizeResource(stub)
	s.items[stub.ID] = stub
	if err := s.save(); err != nil {
		delete(s.items, stub.ID)
		return nil, err
	}
	if err := workspace.EnsureResource(project, env, stub); err != nil {
		return nil, err
	}
	cp := *stub
	return &cp, nil
}

func (s *ResourceStore) CreateMigrated(res *models.Resource) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if res.LegacyStackID != "" {
		for _, existing := range s.items {
			if existing.LegacyStackID == res.LegacyStackID {
				return nil
			}
		}
	}
	s.normalizeResource(res)
	s.items[res.ID] = res
	return s.save()
}

func (s *ResourceStore) Update(id string, req models.UpdateResourceRequest) (*models.Resource, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, ok := s.items[id]
	if !ok {
		return nil, ErrResourceNotFound
	}
	if req.Name != "" {
		res.Name = req.Name
		res.Slug = Slugify(req.Name)
	}
	res.Description = req.Description
	if req.Type != "" {
		res.Type = req.Type
	}
	res.CatalogAppID = req.CatalogAppID
	res.Image = req.Image
	res.Command = req.Command
	if req.Volumes != nil {
		res.Volumes = req.Volumes
	}
	res.ComposeYAML = req.ComposeYAML
	res.EnvContent = req.EnvContent
	res.ServiceName = req.ServiceName
	if req.HasHTTP != nil {
		res.HasHTTP = *req.HasHTTP
	}
	res.Domain = req.Domain
	if req.InternalPort > 0 {
		res.InternalPort = req.InternalPort
	}
	if req.IsDatabase != nil {
		res.IsDatabase = *req.IsDatabase
	}
	res.UpdatedAt = time.Now()
	s.normalizeResource(res)
	if err := s.save(); err != nil {
		return nil, err
	}
	cp := *res
	return &cp, nil
}

func (s *ResourceStore) SetDeployStatus(id string, status models.ResourceStatus, msg, errMsg string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, ok := s.items[id]
	if !ok {
		return ErrResourceNotFound
	}
	now := time.Now()
	if status == models.ResourceStatusDeployed || status == models.ResourceStatusError || status == models.ResourceStatusStopped {
		res.LastDeployAt = &now
	}
	res.Status = status
	res.LastDeployMessage = msg
	res.LastDeployError = errMsg
	res.UpdatedAt = now
	return s.save()
}

func (s *ResourceStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[id]; !ok {
		return ErrResourceNotFound
	}
	delete(s.items, id)
	return s.save()
}

func (s *ResourceStore) DeleteByProject(projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, it := range s.items {
		if it.ProjectID == projectID {
			delete(s.items, id)
		}
	}
	return s.save()
}

func (s *ResourceStore) DeleteByEnvironment(environmentID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, it := range s.items {
		if it.EnvironmentID == environmentID {
			delete(s.items, id)
		}
	}
	return s.save()
}

func (s *ResourceStore) normalizeResource(res *models.Resource) {
	if res.Type == "" {
		res.Type = models.ResourceTypeCompose
	}
	if res.Status == "" {
		res.Status = models.ResourceStatusIdle
	}
	if !res.HasHTTP {
		res.Domain = ""
		res.InternalPort = 0
	}
	res.Domain = strings.TrimSpace(res.Domain)
	res.ServiceName = Slugify(res.ServiceName)
	if res.ServiceName == "item" {
		res.ServiceName = ""
	}
}
