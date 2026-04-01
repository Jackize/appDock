package handlers

import (
	"errors"
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	dockerService       *services.DockerService
	statsHistoryService *services.StatsHistoryService
}

func NewSystemHandler(ds *services.DockerService, shs *services.StatsHistoryService) *SystemHandler {
	return &SystemHandler{
		dockerService:       ds,
		statsHistoryService: shs,
	}
}

// GetSystemInfo returns Docker system info (or basic info if Docker is not available)
func (h *SystemHandler) GetSystemInfo(c *gin.Context) {
	info, err := h.dockerService.GetSystemInfo()
	if err != nil {
		if errors.Is(err, services.ErrDockerNotConnected) {
			// Return basic system info when Docker is not available
			basicInfo := h.dockerService.GetBasicSystemInfo()
			c.JSON(http.StatusOK, gin.H{
				"dockerAvailable": false,
				"info":            basicInfo,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"dockerAvailable": true,
		"info":            info,
	})
}

// GetDockerStatus returns Docker connection status
func (h *SystemHandler) GetDockerStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"connected": h.dockerService.IsConnected(),
	})
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

// GetStatsHistory trả về lịch sử thống kê
func (h *SystemHandler) GetStatsHistory(c *gin.Context) {
	history := h.statsHistoryService.GetHistory()
	c.JSON(http.StatusOK, history)
}

