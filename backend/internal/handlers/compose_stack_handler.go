package handlers

import (
	"context"
	"net/http"
	"strings"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ComposeStackHandler struct {
	stacks        *services.ComposeStackStore
	projects      *services.ProjectStore
	compose       *services.ComposeService
	serverManager *services.ServerManager
}

func NewComposeStackHandler(
	stacks *services.ComposeStackStore,
	projects *services.ProjectStore,
	compose *services.ComposeService,
	sm *services.ServerManager,
) *ComposeStackHandler {
	return &ComposeStackHandler{
		stacks:        stacks,
		projects:      projects,
		compose:       compose,
		serverManager: sm,
	}
}

func (h *ComposeStackHandler) List(c *gin.Context) {
	pid := c.Query("projectId")
	if pid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "projectId query required"})
		return
	}
	list := h.stacks.ListByProject(pid)
	c.JSON(http.StatusOK, list)
}

func (h *ComposeStackHandler) Get(c *gin.Context) {
	id := c.Param("id")
	st, err := h.stacks.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *ComposeStackHandler) Create(c *gin.Context) {
	var req models.CreateComposeStackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := h.projects.Get(req.ProjectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project not found"})
		return
	}
	if req.ServerID == "" {
		req.ServerID = "local"
	}
	if !h.serverManager.IsLocal(req.ServerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrComposeLocalOnly.Error()})
		return
	}
	st, err := h.stacks.Create(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := h.compose.WriteFiles(st.ID, st.ComposeYAML, st.EnvContent); err != nil {
		_ = h.stacks.Delete(st.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, st)
}

func (h *ComposeStackHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateComposeStackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	st, err := h.stacks.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		req.Name = st.Name
	}
	if req.ComposeProjectName == "" {
		req.ComposeProjectName = st.ComposeProjectName
	}
	if req.ComposeYAML == "" {
		req.ComposeYAML = st.ComposeYAML
	}
	if req.ServerID == "" {
		req.ServerID = st.ServerID
	}
	if req.ServerID != "" && !h.serverManager.IsLocal(req.ServerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrComposeLocalOnly.Error()})
		return
	}
	updated, err := h.stacks.Update(id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := h.compose.WriteFiles(updated.ID, updated.ComposeYAML, updated.EnvContent); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *ComposeStackHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if _, err := h.stacks.Get(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if err := h.stacks.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = h.compose.RemoveWorkDir(id)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *ComposeStackHandler) Deploy(c *gin.Context) {
	id := c.Param("id")
	st, err := h.stacks.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if !h.serverManager.IsLocal(st.ServerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrComposeLocalOnly.Error()})
		return
	}
	if err := h.compose.WriteFiles(st.ID, st.ComposeYAML, st.EnvContent); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.compose.ValidateDockerCompose(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	out, err := h.compose.Deploy(ctx, st.ComposeProjectName, st.ID)
	msg := strings.TrimSpace(out)
	if len(msg) > 8000 {
		msg = msg[:8000] + "…"
	}
	if err != nil {
		if e := h.stacks.SetDeployMeta(id, msg+": "+err.Error()); e != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": e.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "output": out})
		return
	}
	if err := h.stacks.SetDeployMeta(id, msg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	st2, _ := h.stacks.Get(id)
	c.JSON(http.StatusOK, gin.H{"message": "deployed", "output": out, "stack": st2})
}

func (h *ComposeStackHandler) Undeploy(c *gin.Context) {
	id := c.Param("id")
	st, err := h.stacks.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if !h.serverManager.IsLocal(st.ServerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrComposeLocalOnly.Error()})
		return
	}
	ctx := context.Background()
	out, err := h.compose.Undeploy(ctx, st.ComposeProjectName, st.ID)
	msg := strings.TrimSpace(out)
	if len(msg) > 8000 {
		msg = msg[:8000] + "…"
	}
	if err != nil {
		if e := h.stacks.SetDeployMeta(id, msg+": "+err.Error()); e != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": e.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "output": out})
		return
	}
	if err := h.stacks.SetDeployMeta(id, msg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	st2, _ := h.stacks.Get(id)
	c.JSON(http.StatusOK, gin.H{"message": "undeployed", "output": out, "stack": st2})
}
