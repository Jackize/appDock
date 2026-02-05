package middleware

import (
	"net/http"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware tạo middleware xác thực JWT
func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Nếu auth bị tắt, cho phép tất cả requests
		if !authService.IsAuthEnabled() {
			c.Next()
			return
		}

		// Lấy token từ header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Vui lòng đăng nhập để tiếp tục",
			})
			c.Abort()
			return
		}

		// Kiểm tra format "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token không đúng định dạng",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token không hợp lệ hoặc đã hết hạn",
			})
			c.Abort()
			return
		}

		// Lưu thông tin user vào context
		c.Set("username", claims.Username)
		c.Set("claims", claims)

		c.Next()
	}
}

// WebSocketAuthMiddleware xác thực cho WebSocket connections
// Token được truyền qua query parameter vì WebSocket không support custom headers dễ dàng
func WebSocketAuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Nếu auth bị tắt, cho phép tất cả requests
		if !authService.IsAuthEnabled() {
			c.Next()
			return
		}

		// Lấy token từ query parameter
		tokenString := c.Query("token")
		if tokenString == "" {
			// Thử lấy từ header (cho các clients hỗ trợ)
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && parts[0] == "Bearer" {
					tokenString = parts[1]
				}
			}
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token không được cung cấp",
			})
			c.Abort()
			return
		}

		// Validate token
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token không hợp lệ hoặc đã hết hạn",
			})
			c.Abort()
			return
		}

		// Lưu thông tin user vào context
		c.Set("username", claims.Username)
		c.Set("claims", claims)

		c.Next()
	}
}
