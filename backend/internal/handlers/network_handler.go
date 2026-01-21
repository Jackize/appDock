package handlers

import (
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type NetworkHandler struct {
	dockerService *services.DockerService
}

func NewNetworkHandler(ds *services.DockerService) *NetworkHandler {
	return &NetworkHandler{dockerService: ds}
}

// ListNetworks trả về danh sách tất cả networks
func (h *NetworkHandler) ListNetworks(c *gin.Context) {
	networks, err := h.dockerService.ListNetworks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, networks)
}

// GetNetwork trả về chi tiết một network
func (h *NetworkHandler) GetNetwork(c *gin.Context) {
	id := c.Param("id")
	network, err := h.dockerService.GetNetwork(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, network)
}

// CreateNetwork tạo một network mới
func (h *NetworkHandler) CreateNetwork(c *gin.Context) {
	var req services.CreateNetworkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu không hợp lệ"})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng cung cấp tên network"})
		return
	}

	id, err := h.dockerService.CreateNetwork(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "Network đã được tạo"})
}

// RemoveNetwork xóa một network
func (h *NetworkHandler) RemoveNetwork(c *gin.Context) {
	id := c.Param("id")
	if err := h.dockerService.RemoveNetwork(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Network đã được xóa"})
}

