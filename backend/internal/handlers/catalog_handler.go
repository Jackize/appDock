package handlers

import (
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type CatalogHandler struct {
	catalog *services.CatalogService
}

func NewCatalogHandler(catalog *services.CatalogService) *CatalogHandler {
	return &CatalogHandler{catalog: catalog}
}

func (h *CatalogHandler) List(c *gin.Context) {
	c.JSON(http.StatusOK, h.catalog.List())
}
