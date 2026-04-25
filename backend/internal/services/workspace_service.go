package services

import (
	"os"
	"path/filepath"

	"appdock/internal/models"
)

type WorkspaceService struct {
	root string
}

func NewWorkspaceService(dataDir string) (*WorkspaceService, error) {
	root := filepath.Join(dataDir, "workspaces")
	if abs, err := filepath.Abs(root); err == nil {
		root = abs
	}
	if err := os.MkdirAll(root, 0755); err != nil {
		return nil, err
	}
	return &WorkspaceService{root: root}, nil
}

func (w *WorkspaceService) EnvironmentDir(project *models.Project, envSlug string) string {
	ownerSlug := project.OwnerSlug
	if ownerSlug == "" {
		ownerSlug = Slugify(project.Owner)
	}
	projectSlug := project.Slug
	if projectSlug == "" {
		projectSlug = Slugify(project.Name)
	}
	return filepath.Join(w.root, ownerSlug, projectSlug+"-"+ShortID(project.ID), Slugify(envSlug))
}

func (w *WorkspaceService) ResourceDir(project *models.Project, env *models.Environment, resourceID, resourceSlug string) string {
	envDir := env.WorkDir
	if envDir == "" {
		envDir = w.EnvironmentDir(project, env.Slug)
	}
	return filepath.Join(envDir, "resources", Slugify(resourceSlug)+"-"+ShortID(resourceID))
}

func (w *WorkspaceService) EnsureEnvironment(project *models.Project, env *models.Environment) error {
	dir := env.WorkDir
	if dir == "" {
		dir = w.EnvironmentDir(project, env.Slug)
	}
	return os.MkdirAll(filepath.Join(dir, "resources"), 0755)
}

func (w *WorkspaceService) EnsureResource(project *models.Project, env *models.Environment, res *models.Resource) error {
	dir := res.WorkDir
	if dir == "" {
		dir = w.ResourceDir(project, env, res.ID, res.Slug)
	}
	return os.MkdirAll(dir, 0755)
}
