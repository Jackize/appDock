package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"appdock/internal/models"
)

func EnsureProjectV1Defaults(projects *ProjectStore, envs *EnvironmentStore, access *ProjectAccessStore, workspace *WorkspaceService) {
	if projects == nil || envs == nil || workspace == nil {
		return
	}
	for _, project := range projects.List() {
		_, _ = envs.EnsureDefault(project, workspace)
		if access != nil && !access.HasAnyMember(project.ID) {
			_ = access.EnsureLegacyOwner(project.ID)
		}
	}
}

func MigrateComposeStacksToResources(dataDir string, projects *ProjectStore, envs *EnvironmentStore, resources *ResourceStore, workspace *WorkspaceService) {
	if projects == nil || envs == nil || resources == nil || workspace == nil {
		return
	}
	path := filepath.Join(dataDir, "compose_stacks.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var stacks []*models.ComposeStack
	if err := json.Unmarshal(data, &stacks); err != nil {
		return
	}
	for _, stack := range stacks {
		project, err := projects.Get(stack.ProjectID)
		if err != nil {
			continue
		}
		env, err := envs.EnsureDefault(project, workspace)
		if err != nil {
			continue
		}
		slug := Slugify(stack.Name)
		res := &models.Resource{
			ID:                 stack.ID,
			ProjectID:          project.ID,
			EnvironmentID:      env.ID,
			ServerID:           stack.ServerID,
			Name:               stack.Name,
			Slug:               slug,
			Type:               models.ResourceTypeCompose,
			Status:             models.ResourceStatusIdle,
			ComposeProjectName: stack.ComposeProjectName,
			ComposeYAML:        stack.ComposeYAML,
			EnvContent:         stack.EnvContent,
			WorkDir:            workspace.ResourceDir(project, env, stack.ID, slug),
			LastDeployAt:       stack.LastDeployAt,
			LastDeployMessage:  stack.LastDeployMessage,
			LegacyStackID:      stack.ID,
			CreatedAt:          stack.CreatedAt,
			UpdatedAt:          time.Now(),
		}
		if res.ServerID == "" {
			res.ServerID = "local"
		}
		_ = workspace.EnsureResource(project, env, res)
		_ = resources.CreateMigrated(res)
	}
}
