package handlers

import (
	"errors"
	"net/http"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ImageHandler struct {
	serverManager *services.ServerManager
	registryStore *services.RegistryProjectStore
}

func NewImageHandler(sm *services.ServerManager, reg *services.RegistryProjectStore) *ImageHandler {
	return &ImageHandler{serverManager: sm, registryStore: reg}
}

// ListImages trả về danh sách tất cả images
func (h *ImageHandler) ListImages(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	images, err := h.serverManager.ListImages(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

// GetImage trả về chi tiết một image
func (h *ImageHandler) GetImage(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	image, err := h.serverManager.GetImage(serverID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, image)
}

// RemoveImage xóa một image
func (h *ImageHandler) RemoveImage(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := h.serverManager.RemoveImage(serverID, id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Image đã được xóa"})
}

// PullImage pulls an image (plain reference or via registry project credentials).
func (h *ImageHandler) PullImage(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)

	var req struct {
		Image               string `json:"image"`
		RegistryProjectID   string `json:"registryProjectId"`
		Repository          string `json:"repository"`
		Tag                 string `json:"tag"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ref string
	var auth string

	if strings.TrimSpace(req.RegistryProjectID) != "" {
		if h.registryStore == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "registry projects are not available"})
			return
		}
		rp, err := h.registryStore.Get(req.RegistryProjectID)
		if err != nil {
			if errors.Is(err, services.ErrRegistryProjectNotFound) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "registry project not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		repo := strings.TrimSpace(req.Repository)
		if repo == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "repository is required when using registryProjectId"})
			return
		}
		tag := strings.TrimSpace(req.Tag)
		if tag == "" {
			tag = "latest"
		}
		ref = rp.ImageRef(repo, tag)
		auth = services.EncodeRegistryAuth(rp.Username, rp.Password)
	} else {
		if strings.TrimSpace(req.Image) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng cung cấp image hoặc registryProjectId + repository"})
			return
		}
		ref = strings.TrimSpace(req.Image)
	}

	if err := h.serverManager.PullImage(serverID, ref, auth); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Image đã được tải về", "ref": ref})
}

// RemoveImages xóa nhiều images cùng lúc (only local server)
func (h *ImageHandler) RemoveImages(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if !h.serverManager.IsLocal(serverID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bulk remove images only supported for local server"})
		return
	}

	var req struct {
		IDs   []string `json:"ids" binding:"required"`
		Force bool     `json:"force"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng cung cấp danh sách image IDs"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Danh sách image IDs không được rỗng"})
		return
	}

	result, err := h.serverManager.GetLocalDocker().RemoveImages(req.IDs, req.Force)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
