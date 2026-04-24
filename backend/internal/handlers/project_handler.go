package handlers

import (
	"errors"
	"net/http"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ProjectHandler struct {
	store         *services.ProjectStore
	serverStore   *services.ServerStore
	registryStore *services.RegistryProjectStore
}

func NewProjectHandler(store *services.ProjectStore, serverStore *services.ServerStore, registryStore *services.RegistryProjectStore) *ProjectHandler {
	return &ProjectHandler{store: store, serverStore: serverStore, registryStore: registryStore}
}

func (h *ProjectHandler) validateServerID(serverID string) error {
	if serverID == "" || serverID == "local" {
		return nil
	}
	if h.serverStore == nil {
		return nil
	}
	if _, err := h.serverStore.Get(serverID); err != nil {
		return err
	}
	return nil
}

func (h *ProjectHandler) validateRegistryProjectID(id string) error {
	if id == "" {
		return nil
	}
	if h.registryStore == nil {
		return errors.New("registry projects store unavailable")
	}
	_, err := h.registryStore.Get(id)
	return err
}

func (h *ProjectHandler) ListProjects(c *gin.Context) {
	list := h.store.List()
	c.JSON(http.StatusOK, list)
}

func (h *ProjectHandler) GetProject(c *gin.Context) {
	id := c.Param("id")
	p, err := h.store.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *ProjectHandler) CreateProject(c *gin.Context) {
	var req models.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	serverID := req.ServerID
	if serverID == "" {
		serverID = "local"
	}
	if err := h.validateServerID(serverID); err != nil {
		if err == services.ErrServerNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	req.ServerID = serverID

	if err := h.validateRegistryProjectID(req.RegistryProjectID); err != nil {
		if errors.Is(err, services.ErrRegistryProjectNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "registry project not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p, err := h.store.Create(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *ProjectHandler) UpdateProject(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ServerID != "" {
		if err := h.validateServerID(req.ServerID); err != nil {
			if err == services.ErrServerNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "server not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if req.RegistryProjectID != nil {
		rid := *req.RegistryProjectID
		if err := h.validateRegistryProjectID(rid); err != nil {
			if errors.Is(err, services.ErrRegistryProjectNotFound) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "registry project not found"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	p, err := h.store.Update(id, req)
	if err != nil {
		if err == services.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *ProjectHandler) DeleteProject(c *gin.Context) {
	id := c.Param("id")
	if err := h.store.Delete(id); err != nil {
		if err == services.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
