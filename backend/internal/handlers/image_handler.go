package handlers

import (
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ImageHandler struct {
	serverManager *services.ServerManager
}

func NewImageHandler(sm *services.ServerManager) *ImageHandler {
	return &ImageHandler{serverManager: sm}
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

// PullImage pull một image từ registry (only local server)
func (h *ImageHandler) PullImage(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if !h.serverManager.IsLocal(serverID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pull image only supported for local server"})
		return
	}

	var req struct {
		Image string `json:"image" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng cung cấp tên image"})
		return
	}

	if err := h.serverManager.GetLocalDocker().PullImage(req.Image); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Image đã được tải về"})
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
