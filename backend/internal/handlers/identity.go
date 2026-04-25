package handlers

import (
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

func CurrentIdentity(c *gin.Context) services.ProjectIdentity {
	ident := services.ProjectIdentity{Username: "admin"}
	if v, ok := c.Get("claims"); ok {
		if claims, ok := v.(*services.Claims); ok {
			ident.Username = strings.TrimSpace(claims.Username)
			ident.Email = strings.TrimSpace(claims.Email)
			if ident.Username == "" && ident.Email != "" {
				ident.Username = ident.Email
			}
			return ident
		}
	}
	if v, ok := c.Get("username"); ok {
		if username, ok := v.(string); ok && strings.TrimSpace(username) != "" {
			ident.Username = strings.TrimSpace(username)
		}
	}
	return ident
}
