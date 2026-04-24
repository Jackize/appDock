package handlers

import (
	"net/http"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type RegistryProjectHandler struct {
	store *services.RegistryProjectStore
}

func NewRegistryProjectHandler(store *services.RegistryProjectStore) *RegistryProjectHandler {
	return &RegistryProjectHandler{store: store}
}

func (h *RegistryProjectHandler) List(c *gin.Context) {
	list := h.store.List()
	out := make([]models.RegistryProjectResponse, 0, len(list))
	for _, p := range list {
		out = append(out, p.ToResponse())
	}
	c.JSON(http.StatusOK, out)
}

func (h *RegistryProjectHandler) Get(c *gin.Context) {
	id := c.Param("id")
	p, err := h.store.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p.ToResponse())
}

func (h *RegistryProjectHandler) Create(c *gin.Context) {
	var req models.CreateRegistryProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.store.Create(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p.ToResponse())
}

func (h *RegistryProjectHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRegistryProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.store.Update(id, req)
	if err != nil {
		if err == services.ErrRegistryProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p.ToResponse())
}

func (h *RegistryProjectHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.store.Delete(id); err != nil {
		if err == services.ErrRegistryProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
