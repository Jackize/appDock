package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ResourceHandler struct {
	projects      *services.ProjectStore
	envs          *services.EnvironmentStore
	resources     *services.ResourceStore
	access        *services.ProjectAccessStore
	workspace     *services.WorkspaceService
	deployer      *services.ResourceDeployService
	serverManager *services.ServerManager
}

func NewResourceHandler(
	projects *services.ProjectStore,
	envs *services.EnvironmentStore,
	resources *services.ResourceStore,
	access *services.ProjectAccessStore,
	workspace *services.WorkspaceService,
	deployer *services.ResourceDeployService,
	serverManager *services.ServerManager,
) *ResourceHandler {
	return &ResourceHandler{
		projects:      projects,
		envs:          envs,
		resources:     resources,
		access:        access,
		workspace:     workspace,
		deployer:      deployer,
		serverManager: serverManager,
	}
}

func (h *ResourceHandler) List(c *gin.Context) {
	envID := c.Param("environmentId")
	env, err := h.envs.Get(envID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if h.access != nil && !h.access.Can(env.ProjectID, CurrentIdentity(c), models.ProjectRoleViewer) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	resources := h.resources.ListByEnvironment(envID)
	h.applyLiveStatuses(resources)
	c.JSON(http.StatusOK, resources)
}

func (h *ResourceHandler) Create(c *gin.Context) {
	envID := c.Param("environmentId")
	env, err := h.envs.Get(envID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if h.access != nil && !h.access.Can(env.ProjectID, CurrentIdentity(c), models.ProjectRoleDeployer) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	project, err := h.projects.Get(env.ProjectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	var req models.CreateResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	normalizeResourceRequest(&req)
	res, err := h.resources.Create(project, env, req, h.workspace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := h.deployer.WriteFiles(project, env, res); err != nil {
		_ = h.resources.Delete(res.ID)
		_ = os.RemoveAll(res.WorkDir)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, res)
}

func (h *ResourceHandler) Get(c *gin.Context) {
	res, env, ok := h.resourceContext(c, models.ProjectRoleViewer)
	if !ok {
		return
	}
	_ = env
	c.JSON(http.StatusOK, res)
}

func (h *ResourceHandler) Config(c *gin.Context) {
	res, env, ok := h.resourceContext(c, models.ProjectRoleViewer)
	if !ok {
		return
	}
	project, err := h.projects.Get(env.ProjectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	composeYAML, envContent, err := h.deployer.RenderConfig(project, env, res)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"resource":            res,
		"renderedComposeYaml": composeYAML,
		"envContent":          envContent,
		"workDir":             res.WorkDir,
	})
}

func (h *ResourceHandler) Update(c *gin.Context) {
	res, env, ok := h.resourceContext(c, models.ProjectRoleDeployer)
	if !ok {
		return
	}
	project, err := h.projects.Get(env.ProjectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	var req models.UpdateResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	normalizeUpdateResourceRequest(&req)
	updated, err := h.resources.Update(res.ID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := h.deployer.WriteFiles(project, env, updated); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *ResourceHandler) Delete(c *gin.Context) {
	res, _, ok := h.resourceContext(c, models.ProjectRoleDeployer)
	if !ok {
		return
	}
	if err := h.resources.Delete(res.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = os.RemoveAll(res.WorkDir)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *ResourceHandler) Deploy(c *gin.Context) {
	res, env, ok := h.resourceContext(c, models.ProjectRoleDeployer)
	if !ok {
		return
	}
	if !h.serverManager.IsLocal(res.ServerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrComposeLocalOnly.Error()})
		return
	}
	project, err := h.projects.Get(env.ProjectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	_ = h.resources.SetDeployStatus(res.ID, models.ResourceStatusDeploying, "", "")
	out, err := h.deployer.Deploy(context.Background(), project, env, res)
	msg := trimDeployOutput(out)
	if err != nil {
		_ = h.resources.SetDeployStatus(res.ID, models.ResourceStatusError, msg, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "output": out})
		return
	}
	_ = h.resources.SetDeployStatus(res.ID, models.ResourceStatusDeployed, msg, "")
	updated, _ := h.resources.Get(res.ID)
	c.JSON(http.StatusOK, gin.H{"message": "deployed", "output": out, "resource": updated})
}

func (h *ResourceHandler) Undeploy(c *gin.Context) {
	res, _, ok := h.resourceContext(c, models.ProjectRoleDeployer)
	if !ok {
		return
	}
	if !h.serverManager.IsLocal(res.ServerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrComposeLocalOnly.Error()})
		return
	}
	out, err := h.deployer.Undeploy(context.Background(), res)
	msg := trimDeployOutput(out)
	if err != nil {
		_ = h.resources.SetDeployStatus(res.ID, models.ResourceStatusError, msg, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "output": out})
		return
	}
	_ = h.resources.SetDeployStatus(res.ID, models.ResourceStatusStopped, msg, "")
	updated, _ := h.resources.Get(res.ID)
	c.JSON(http.StatusOK, gin.H{"message": "undeployed", "output": out, "resource": updated})
}

func (h *ResourceHandler) resourceContext(c *gin.Context, role models.ProjectRole) (*models.Resource, *models.Environment, bool) {
	id := c.Param("id")
	res, err := h.resources.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return nil, nil, false
	}
	env, err := h.envs.Get(res.EnvironmentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return nil, nil, false
	}
	if h.access != nil && !h.access.Can(env.ProjectID, CurrentIdentity(c), role) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return nil, nil, false
	}
	return res, env, true
}

func normalizeResourceRequest(req *models.CreateResourceRequest) {
	req.Domain = strings.TrimSpace(req.Domain)
	req.Image = strings.TrimSpace(req.Image)
	req.CatalogAppID = strings.TrimSpace(req.CatalogAppID)
	if !req.HasHTTP {
		req.Domain = ""
		req.InternalPort = 0
	}
}

func normalizeUpdateResourceRequest(req *models.UpdateResourceRequest) {
	req.Domain = strings.TrimSpace(req.Domain)
	req.Image = strings.TrimSpace(req.Image)
	req.CatalogAppID = strings.TrimSpace(req.CatalogAppID)
	if req.HasHTTP != nil && !*req.HasHTTP {
		req.Domain = ""
		req.InternalPort = 0
	}
}

func trimDeployOutput(out string) string {
	msg := strings.TrimSpace(out)
	if len(msg) > 8000 {
		return msg[:8000] + "..."
	}
	return msg
}

type composeProjectRuntime struct {
	total   int
	running int
}

const composeProjectLabel = "com.docker.compose.project"

func (h *ResourceHandler) applyLiveStatuses(resources []*models.Resource) {
	if h.serverManager == nil || len(resources) == 0 {
		return
	}

	byServer := make(map[string][]*models.Resource)
	for _, res := range resources {
		byServer[res.ServerID] = append(byServer[res.ServerID], res)
	}

	for serverID, serverResources := range byServer {
		raw, err := h.serverManager.ListContainers(serverID, true)
		if err != nil {
			continue
		}
		containers, err := normalizeContainerInfos(raw)
		if err != nil {
			continue
		}
		runtimes := composeProjectRuntimes(containers)
		for _, res := range serverResources {
			runtime, ok := runtimes[res.ComposeProjectName]
			res.Status = liveResourceStatus(res.Status, runtime, ok)
		}
	}
}

func normalizeContainerInfos(raw interface{}) ([]services.ContainerInfo, error) {
	if containers, ok := raw.([]services.ContainerInfo); ok {
		return containers, nil
	}
	data, err := json.Marshal(raw)
	if err != nil {
		return nil, err
	}
	var containers []services.ContainerInfo
	if err := json.Unmarshal(data, &containers); err != nil {
		return nil, err
	}
	return containers, nil
}

func composeProjectRuntimes(containers []services.ContainerInfo) map[string]composeProjectRuntime {
	runtimes := make(map[string]composeProjectRuntime)
	for _, container := range containers {
		projectName := container.Labels[composeProjectLabel]
		if projectName == "" {
			continue
		}
		runtime := runtimes[projectName]
		runtime.total++
		if container.State == "running" {
			runtime.running++
		}
		runtimes[projectName] = runtime
	}
	return runtimes
}

func liveResourceStatus(current models.ResourceStatus, runtime composeProjectRuntime, found bool) models.ResourceStatus {
	if current == models.ResourceStatusDeploying {
		return current
	}
	if !found || runtime.total == 0 {
		if current == models.ResourceStatusDeployed {
			return models.ResourceStatusStopped
		}
		return current
	}
	if runtime.running > 0 {
		return models.ResourceStatusDeployed
	}
	return models.ResourceStatusStopped
}
