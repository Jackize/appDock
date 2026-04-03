package handlers

import (
	"net/http"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type NginxHandler struct {
	serverManager *services.ServerManager
}

func NewNginxHandler(sm *services.ServerManager) *NginxHandler {
	return &NginxHandler{serverManager: sm}
}

// ==================== Nginx System ====================

func (h *NginxHandler) GetStatus(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	status, err := h.serverManager.GetNginxStatus(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *NginxHandler) Install(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if err := h.serverManager.InstallNginx(serverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx đã được cài đặt thành công"})
}

func (h *NginxHandler) InstallCertbot(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if err := h.serverManager.InstallCertbot(serverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Certbot đã được cài đặt thành công"})
}

func (h *NginxHandler) Start(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if err := h.serverManager.StartNginx(serverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx đã được khởi động"})
}

func (h *NginxHandler) Stop(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if err := h.serverManager.StopNginx(serverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx đã được dừng"})
}

func (h *NginxHandler) Reload(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if err := h.serverManager.ReloadNginx(serverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx đã được reload"})
}

func (h *NginxHandler) TestConfig(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	valid, output, err := h.serverManager.TestNginxConfig(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"valid": valid, "output": output})
}

// ==================== Domain Management ====================

func (h *NginxHandler) ListDomains(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	domains, err := h.serverManager.ListDomains(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, domains)
}

func (h *NginxHandler) GetDomain(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	domain, err := h.serverManager.GetDomain(serverID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, domain)
}

func (h *NginxHandler) CreateDomain(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	var req models.CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu không hợp lệ: " + err.Error()})
		return
	}

	domain, err := h.serverManager.CreateDomain(serverID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, domain)
}

func (h *NginxHandler) UpdateDomain(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	var req models.UpdateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu không hợp lệ: " + err.Error()})
		return
	}

	domain, err := h.serverManager.UpdateDomain(serverID, id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, domain)
}

func (h *NginxHandler) DeleteDomain(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	if err := h.serverManager.DeleteDomain(serverID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Domain đã được xóa"})
}

func (h *NginxHandler) EnableDomain(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	if err := h.serverManager.EnableDomain(serverID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Domain đã được kích hoạt"})
}

func (h *NginxHandler) DisableDomain(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	if err := h.serverManager.DisableDomain(serverID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Domain đã được tắt"})
}

func (h *NginxHandler) GetDomainConfig(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	id := c.Param("id")
	config, err := h.serverManager.GetDomainConfig(serverID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, config)
}

// ==================== SSL / Certificate Management ====================

func (h *NginxHandler) ListCertificates(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	certs, err := h.serverManager.ListCertificates(serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, certs)
}

func (h *NginxHandler) RequestCertificate(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	var req models.RequestCertificateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu không hợp lệ: " + err.Error()})
		return
	}

	if err := h.serverManager.RequestCertificate(serverID, req.Domain, req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Chứng chỉ SSL đã được cấp thành công"})
}

func (h *NginxHandler) RevokeCertificate(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	domain := c.Param("domain")
	if err := h.serverManager.RevokeCertificate(serverID, domain); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Chứng chỉ SSL đã được thu hồi"})
}
