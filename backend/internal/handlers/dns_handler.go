package handlers

import (
	"net/http"
	"os"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type DNSHandler struct {
	cf *services.CloudflareDNSService
}

func NewDNSHandler(cf *services.CloudflareDNSService) *DNSHandler {
	return &DNSHandler{cf: cf}
}

func (h *DNSHandler) getCloudflareAuth(c *gin.Context) services.CloudflareAuth {
	// Prefer per-request credentials from UI
	token := strings.TrimSpace(c.GetHeader("X-Cloudflare-Token"))
	email := strings.TrimSpace(c.GetHeader("X-Cloudflare-Email"))
	apiKey := strings.TrimSpace(c.GetHeader("X-Cloudflare-Key"))
	if token != "" || (email != "" && apiKey != "") {
		return services.CloudflareAuth{Token: token, Email: email, APIKey: apiKey}
	}

	// Fallback to server env credentials
	envToken := strings.TrimSpace(os.Getenv("CLOUDFLARE_API_TOKEN"))
	envEmail := strings.TrimSpace(os.Getenv("CLOUDFLARE_EMAIL"))
	envKey := strings.TrimSpace(os.Getenv("CLOUDFLARE_API_KEY"))
	return services.CloudflareAuth{Token: envToken, Email: envEmail, APIKey: envKey}
}

func (h *DNSHandler) VerifyCloudflare(c *gin.Context) {
	auth := h.getCloudflareAuth(c)
	result, err := h.cf.Verify(c.Request.Context(), auth)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to verify Cloudflare credentials."})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *DNSHandler) ListCloudflareZones(c *gin.Context) {
	auth := h.getCloudflareAuth(c)
	name := strings.TrimSpace(c.Query("name"))
	zones, err := h.cf.ListZones(c.Request.Context(), auth, name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, zones)
}

func (h *DNSHandler) ListCloudflareDNSRecords(c *gin.Context) {
	auth := h.getCloudflareAuth(c)
	zoneID := c.Param("zoneId")
	recordType := strings.TrimSpace(c.Query("type"))
	recordName := strings.TrimSpace(c.Query("name"))
	records, err := h.cf.ListDNSRecords(c.Request.Context(), auth, zoneID, recordType, recordName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}

func (h *DNSHandler) CreateCloudflareDNSRecord(c *gin.Context) {
	auth := h.getCloudflareAuth(c)
	zoneID := c.Param("zoneId")
	var req services.CloudflareCreateDNSRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data: " + err.Error()})
		return
	}
	if strings.TrimSpace(req.Type) == "" || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Content) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: type, name, content"})
		return
	}
	created, err := h.cf.CreateDNSRecord(c.Request.Context(), auth, zoneID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *DNSHandler) UpdateCloudflareDNSRecord(c *gin.Context) {
	auth := h.getCloudflareAuth(c)
	zoneID := c.Param("zoneId")
	recordID := c.Param("recordId")
	var req services.CloudflareUpdateDNSRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data: " + err.Error()})
		return
	}
	if strings.TrimSpace(req.Type) == "" || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Content) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: type, name, content"})
		return
	}
	updated, err := h.cf.UpdateDNSRecord(c.Request.Context(), auth, zoneID, recordID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *DNSHandler) DeleteCloudflareDNSRecord(c *gin.Context) {
	auth := h.getCloudflareAuth(c)
	zoneID := c.Param("zoneId")
	recordID := c.Param("recordId")
	if err := h.cf.DeleteDNSRecord(c.Request.Context(), auth, zoneID, recordID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "DNS record deleted successfully"})
}
