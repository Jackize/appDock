package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sync"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type EnvironmentHandler struct {
	projects  *services.ProjectStore
	envs      *services.EnvironmentStore
	resources *services.ResourceStore
	access    *services.ProjectAccessStore
	workspace *services.WorkspaceService
	deployer  *services.ResourceDeployService
}

func NewEnvironmentHandler(
	projects *services.ProjectStore,
	envs *services.EnvironmentStore,
	resources *services.ResourceStore,
	access *services.ProjectAccessStore,
	workspace *services.WorkspaceService,
	deployer *services.ResourceDeployService,
) *EnvironmentHandler {
	return &EnvironmentHandler{
		projects:  projects,
		envs:      envs,
		resources: resources,
		access:    access,
		workspace: workspace,
		deployer:  deployer,
	}
}

func (h *EnvironmentHandler) List(c *gin.Context) {
	projectID := c.Param("id")
	if h.access != nil && !h.access.Can(projectID, CurrentIdentity(c), models.ProjectRoleViewer) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	c.JSON(http.StatusOK, h.envs.ListByProject(projectID))
}

func (h *EnvironmentHandler) Create(c *gin.Context) {
	projectID := c.Param("id")
	if h.access != nil && !h.access.Can(projectID, CurrentIdentity(c), models.ProjectRoleDeployer) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	project, err := h.projects.Get(projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	var req models.CreateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	env, err := h.envs.Create(project, req, h.workspace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, env)
}

func (h *EnvironmentHandler) Delete(c *gin.Context) {
	envID := c.Param("id")
	env, err := h.envs.Get(envID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if h.access != nil && !h.access.Can(env.ProjectID, CurrentIdentity(c), models.ProjectRoleDeployer) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}

	resources := h.resources.ListByEnvironment(env.ID)
	force := c.Query("force") == "true"
	if len(resources) > 0 && !force {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "environment has resources; confirm force delete to undeploy and remove them",
			"resources": resources,
		})
		return
	}

	if len(resources) > 0 {
		if err := h.undeployEnvironmentResources(c.Request.Context(), resources); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := h.resources.DeleteByEnvironment(env.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if h.deployer != nil && env.NetworkName != "" {
		if _, err := h.deployer.RemoveNetwork(c.Request.Context(), env.NetworkName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	if env.WorkDir != "" {
		_ = os.RemoveAll(env.WorkDir)
	}
	if err := h.envs.Delete(env.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "environment deleted", "removedResources": len(resources)})
}

func (h *EnvironmentHandler) undeployEnvironmentResources(ctx context.Context, resources []*models.Resource) error {
	if h.deployer == nil {
		return errors.New("resource deployer unavailable")
	}
	const maxConcurrentUndeploys = 4
	sem := make(chan struct{}, maxConcurrentUndeploys)
	var wg sync.WaitGroup
	var mu sync.Mutex
	errs := make([]error, 0)

	for _, resource := range resources {
		resource := resource
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			if _, err := h.deployer.Undeploy(ctx, resource); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("%s: %w", resource.Name, err))
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if len(errs) == 0 {
		return nil
	}
	msg := "failed to undeploy resources before deleting environment"
	for _, err := range errs {
		msg += "; " + err.Error()
	}
	return errors.New(msg)
}
