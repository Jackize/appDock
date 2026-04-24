package handlers

import (
	"net/http"
	"strings"
	"time"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type TraefikHandler struct {
	store   *services.TraefikStore
	service *services.TraefikService
}

func NewTraefikHandler(store *services.TraefikStore, service *services.TraefikService) *TraefikHandler {
	return &TraefikHandler{store: store, service: service}
}

func (h *TraefikHandler) GetStatus(c *gin.Context) {
	cfg := h.store.Get()
	running, errMsg := h.service.Status()
	c.JSON(http.StatusOK, gin.H{
		"config":  cfg,
		"running": running,
		"status":  errMsg,
	})
}

func (h *TraefikHandler) Apply(c *gin.Context) {
	var req models.UpdateTraefikConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// update stored config first
	cfg, err := h.store.Update(func(cfg *models.TraefikConfig) {
		if req.Enabled != nil {
			cfg.Enabled = *req.Enabled
		}
		if req.Domain != "" {
			cfg.Domain = strings.TrimSpace(req.Domain)
		}
		if req.CloudflareToken != "" {
			cfg.CloudflareToken = strings.TrimSpace(req.CloudflareToken)
		}
		if req.ACMEEmail != "" {
			cfg.ACMEEmail = strings.TrimSpace(req.ACMEEmail)
		}
		if req.DashboardHost != "" || cfg.DashboardHost != "" {
			// allow clearing by sending empty string
			cfg.DashboardHost = strings.TrimSpace(req.DashboardHost)
		}
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	applyOut := ""
	applyErr := ""
	if cfg.Enabled {
		if cfg.ACMEEmail == "" || cfg.CloudflareToken == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "acmeEmail and cloudflareToken are required"})
			return
		}
		out, err := h.service.Up(cfg.Domain, cfg.ACMEEmail, cfg.CloudflareToken, cfg.DashboardHost)
		applyOut = out
		if err != nil {
			applyErr = err.Error()
		}
	} else {
		out, err := h.service.Down()
		applyOut = out
		if err != nil {
			applyErr = err.Error()
		}
	}

	now := time.Now()
	updated, _ := h.store.Update(func(cfg *models.TraefikConfig) {
		cfg.LastApplyOutput = strings.TrimSpace(applyOut)
		cfg.LastApplyError = strings.TrimSpace(applyErr)
		cfg.LastAppliedAt = &now
	})

	if applyErr != "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": applyErr, "output": applyOut, "config": updated})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "applied", "output": applyOut, "config": updated})
}

func (h *TraefikHandler) Logs(c *gin.Context) {
	tail := c.DefaultQuery("tail", "200")
	out, err := h.service.Logs(tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "output": out})
		return
	}
	c.JSON(http.StatusOK, gin.H{"logs": out})
}

