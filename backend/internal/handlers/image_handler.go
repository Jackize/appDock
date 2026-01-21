package handlers

import (
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ImageHandler struct {
	dockerService *services.DockerService
}

func NewImageHandler(ds *services.DockerService) *ImageHandler {
	return &ImageHandler{dockerService: ds}
}

// ListImages trả về danh sách tất cả images
func (h *ImageHandler) ListImages(c *gin.Context) {
	images, err := h.dockerService.ListImages()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

// GetImage trả về chi tiết một image
func (h *ImageHandler) GetImage(c *gin.Context) {
	id := c.Param("id")
	image, err := h.dockerService.GetImage(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, image)
}

// RemoveImage xóa một image
func (h *ImageHandler) RemoveImage(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := h.dockerService.RemoveImage(id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Image đã được xóa"})
}

// PullImage pull một image từ registry
func (h *ImageHandler) PullImage(c *gin.Context) {
	var req struct {
		Image string `json:"image" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng cung cấp tên image"})
		return
	}

	if err := h.dockerService.PullImage(req.Image); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Image đã được tải về"})
}

// RemoveImages xóa nhiều images cùng lúc
func (h *ImageHandler) RemoveImages(c *gin.Context) {
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

	result := h.dockerService.RemoveImages(req.IDs, req.Force)
	c.JSON(http.StatusOK, result)
}
