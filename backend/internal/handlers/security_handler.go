package handlers

import (
	"encoding/json"
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type SecurityHandler struct {
	app *services.SecurityApp
	sm  *services.ServerManager
}

func NewSecurityHandler(app *services.SecurityApp, sm *services.ServerManager) *SecurityHandler {
	return &SecurityHandler{app: app, sm: sm}
}

// GetSnapshot returns current network snapshot for selected server (X-Server-ID).
func (h *SecurityHandler) GetSnapshot(c *gin.Context) {
	serverID := GetServerIDFromRequest(c)
	if serverID == "" {
		serverID = "local"
	}
	snap, err := h.sm.GetNetworkSnapshot(serverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, snap)
}

func (h *SecurityHandler) ListReports(c *gin.Context) {
	serverID := c.Query("serverId")
	severity := c.Query("severity")
	status := c.Query("status")
	list := h.app.ListReports(serverID, severity, status)
	c.JSON(http.StatusOK, list)
}

func (h *SecurityHandler) GetReport(c *gin.Context) {
	id := c.Param("id")
	r, err := h.app.GetReport(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, r)
}

type patchReportBody struct {
	Status *services.SecurityReportStatus `json:"status"`
	Notes  *string                        `json:"notes"`
}

func (h *SecurityHandler) PatchReport(c *gin.Context) {
	id := c.Param("id")
	var body patchReportBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	r, err := h.app.PatchReport(id, body.Status, body.Notes)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, r)
}

type analyzeBody struct {
	ServerID string `json:"serverId"`
	Force    bool   `json:"force"`
}

func (h *SecurityHandler) Analyze(c *gin.Context) {
	var body analyzeBody
	_ = c.ShouldBindJSON(&body)
	serverID := body.ServerID
	if serverID == "" {
		serverID = GetServerIDFromRequest(c)
	}
	if serverID == "" {
		serverID = "local"
	}
	r, err := h.app.RunManualAnalysis(serverID, body.Force)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, r)
}

type chatBody struct {
	Messages []services.ChatMessage `json:"messages"`
	ReportID string                 `json:"reportId"`
}

func (h *SecurityHandler) Chat(c *gin.Context) {
	var body chatBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(body.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages required"})
		return
	}
	reportCtx := ""
	if body.ReportID != "" {
		rep, err := h.app.GetReport(body.ReportID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
			return
		}
		b, _ := json.Marshal(rep)
		reportCtx = truncateRunes(string(b), 12000)
	}
	reply, err := h.app.ChatWithReport(reportCtx, body.Messages)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reply": reply})
}

func truncateRunes(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "\n…(truncated)"
}
