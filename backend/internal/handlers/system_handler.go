package handlers

import (
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	dockerService *services.DockerService
}

func NewSystemHandler(ds *services.DockerService) *SystemHandler {
	return &SystemHandler{dockerService: ds}
}

// GetSystemInfo trả về thông tin hệ thống Docker
func (h *SystemHandler) GetSystemInfo(c *gin.Context) {
	info, err := h.dockerService.GetSystemInfo()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

// GetSystemStats trả về thống kê hệ thống
func (h *SystemHandler) GetSystemStats(c *gin.Context) {
	stats, err := h.dockerService.GetSystemStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

