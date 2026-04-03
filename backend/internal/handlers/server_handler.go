package handlers

import (
	"net/http"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ServerHandler struct {
	store   *services.ServerStore
	manager *services.ServerManager
}

func NewServerHandler(store *services.ServerStore, manager *services.ServerManager) *ServerHandler {
	return &ServerHandler{
		store:   store,
		manager: manager,
	}
}

// ListServers returns all registered servers
func (h *ServerHandler) ListServers(c *gin.Context) {
	servers := h.store.List()
	response := make([]models.ServerResponse, len(servers))
	for i, server := range servers {
		response[i] = server.ToResponse()
	}
	c.JSON(http.StatusOK, response)
}

// GetServer returns a single server by ID
func (h *ServerHandler) GetServer(c *gin.Context) {
	id := c.Param("id")
	server, err := h.store.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, server.ToResponse())
}

// CreateServer registers a new remote server
func (h *ServerHandler) CreateServer(c *gin.Context) {
	var req models.CreateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server, err := h.store.Create(req.Name, req.Host, req.APIKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add agent client
	h.manager.AddAgentClient(server)

	c.JSON(http.StatusCreated, server.ToResponse())
}

// UpdateServer updates server configuration
func (h *ServerHandler) UpdateServer(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server, err := h.store.Update(id, req)
	if err != nil {
		if err == services.ErrServerNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Update agent client
	h.manager.UpdateAgentClient(server)

	c.JSON(http.StatusOK, server.ToResponse())
}

// DeleteServer removes a server registration
func (h *ServerHandler) DeleteServer(c *gin.Context) {
	id := c.Param("id")
	if err := h.store.Delete(id); err != nil {
		if err == services.ErrServerNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else if err == services.ErrCannotDeleteLocal {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Remove agent client
	h.manager.RemoveAgentClient(id)

	c.JSON(http.StatusOK, gin.H{"message": "Server deleted"})
}

// TestConnection tests connectivity to a server
func (h *ServerHandler) TestConnection(c *gin.Context) {
	id := c.Param("id")
	if err := h.manager.TestConnection(id); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error(), "connected": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Connection successful", "connected": true})
}

// GetCurrentServer returns the server from X-Server-ID header or default
func GetServerIDFromRequest(c *gin.Context) string {
	serverID := c.GetHeader("X-Server-ID")
	if serverID == "" {
		serverID = c.Query("server")
	}
	return serverID
}
