package handlers

import (
	"errors"
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	serverManager       *services.ServerManager
	statsHistoryService *services.StatsHistoryService
}

func NewSystemHandler(sm *services.ServerManager, shs *services.StatsHistoryService) *SystemHandler {
	return &SystemHandler{
		serverManager:       sm,
		statsHistoryService: shs,
	}
}

// GetSystemInfo returns Docker system info (or basic info if Docker is not available)
func (h *SystemHandler) GetSystemInfo(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)

	if h.serverManager.IsLocal(serverID) {
		info, err := h.serverManager.GetLocalDocker().GetSystemInfo()
		if err != nil {
			if errors.Is(err, services.ErrDockerNotConnected) {
				basicInfo := h.serverManager.GetLocalDocker().GetBasicSystemInfo()
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
		return
	}

	// For remote servers, return combined system stats
	stats, err := h.serverManager.GetSystemStats(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"dockerAvailable": true,
		"info":            stats,
	})
}

// GetDockerStatus returns Docker connection status
func (h *SystemHandler) GetDockerStatus(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)

	if h.serverManager.IsLocal(serverID) {
		c.JSON(http.StatusOK, gin.H{
			"connected": h.serverManager.GetLocalDocker().IsConnected(),
		})
		return
	}

	// For remote servers, test the connection
	err := h.serverManager.TestConnection(serverID)
	c.JSON(http.StatusOK, gin.H{
		"connected": err == nil,
	})
}

// GetSystemStats trả về thống kê hệ thống
func (h *SystemHandler) GetSystemStats(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	stats, err := h.serverManager.GetSystemStats(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetStatsHistory trả về lịch sử thống kê (only local server)
func (h *SystemHandler) GetStatsHistory(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if !h.serverManager.IsLocal(serverID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stats history only available for local server"})
		return
	}
	history := h.statsHistoryService.GetHistory()
	c.JSON(http.StatusOK, history)
}
