package services

import (
	"context"
	"strings"

	"appdock/internal/models"
)

type ResourceDeployService struct {
	renderer *ResourceRenderer
	compose  *ComposeService
}

func NewResourceDeployService(renderer *ResourceRenderer, compose *ComposeService) *ResourceDeployService {
	return &ResourceDeployService{renderer: renderer, compose: compose}
}

func (s *ResourceDeployService) WriteFiles(project *models.Project, env *models.Environment, res *models.Resource) error {
	yml, err := s.renderer.Render(project, env, res)
	if err != nil {
		return err
	}
	return s.compose.WriteResourceFiles(res.WorkDir, yml, s.renderer.EnvContent(res))
}

func (s *ResourceDeployService) RenderConfig(project *models.Project, env *models.Environment, res *models.Resource) (composeYAML string, envContent string, err error) {
	composeYAML, err = s.renderer.Render(project, env, res)
	if err != nil {
		return "", "", err
	}
	return composeYAML, s.renderer.EnvContent(res), nil
}

func (s *ResourceDeployService) Deploy(ctx context.Context, project *models.Project, env *models.Environment, res *models.Resource) (string, error) {
	if _, err := s.compose.EnsureNetwork(ctx, env.NetworkName); err != nil {
		return "", err
	}
	if res.HasHTTP && strings.TrimSpace(res.Domain) != "" {
		if _, err := s.compose.EnsureNetwork(ctx, "proxy"); err != nil {
			return "", err
		}
	}
	if err := s.WriteFiles(project, env, res); err != nil {
		return "", err
	}
	if err := s.compose.ValidateDockerCompose(); err != nil {
		return "", err
	}
	return s.compose.DeployDir(ctx, res.ComposeProjectName, res.WorkDir)
}

func (s *ResourceDeployService) Undeploy(ctx context.Context, res *models.Resource) (string, error) {
	return s.compose.UndeployDir(ctx, res.ComposeProjectName, res.WorkDir)
}

func (s *ResourceDeployService) RemoveNetwork(ctx context.Context, networkName string) (string, error) {
	return s.compose.RemoveNetwork(ctx, networkName)
}
