package handlers

import (
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type VolumeHandler struct {
	dockerService *services.DockerService
}

func NewVolumeHandler(ds *services.DockerService) *VolumeHandler {
	return &VolumeHandler{dockerService: ds}
}

// ListVolumes trả về danh sách tất cả volumes
func (h *VolumeHandler) ListVolumes(c *gin.Context) {
	volumes, err := h.dockerService.ListVolumes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, volumes)
}

// GetVolume trả về chi tiết một volume
func (h *VolumeHandler) GetVolume(c *gin.Context) {
	name := c.Param("name")
	volume, err := h.dockerService.GetVolume(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, volume)
}

// CreateVolume tạo một volume mới
func (h *VolumeHandler) CreateVolume(c *gin.Context) {
	var req services.CreateVolumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu không hợp lệ"})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng cung cấp tên volume"})
		return
	}

	volume, err := h.dockerService.CreateVolume(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, volume)
}

// RemoveVolume xóa một volume
func (h *VolumeHandler) RemoveVolume(c *gin.Context) {
	name := c.Param("name")
	force := c.Query("force") == "true"
	if err := h.dockerService.RemoveVolume(name, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Volume đã được xóa"})
}

