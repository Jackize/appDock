package middleware

import (
	"net/http"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
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

// WebSocketAuthMiddleware xác thực cho WebSocket connections.
// Token ưu tiên: Sec-WebSocket-Protocol (tránh lộ token trong URL), sau đó ?token=, rồi Authorization.
func WebSocketAuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Nếu auth bị tắt, cho phép tất cả requests
		if !authService.IsAuthEnabled() {
			c.Next()
			return
		}

		tokenString, wsProtoReply := websocketTokenFromRequest(c)

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
		if wsProtoReply != "" {
			c.Set("ws_sec_subprotocol_reply", wsProtoReply)
		}

		c.Next()
	}
}

// websocketTokenFromRequest returns the JWT and, if the client offered it as a WebSocket
// subprotocol, the same string for Sec-WebSocket-Protocol on the upgrade response.
func websocketTokenFromRequest(c *gin.Context) (token string, secWebSocketProtocolReply string) {
	for _, p := range websocket.Subprotocols(c.Request) {
		if isLikelyJWT(p) {
			return p, p
		}
	}
	if q := c.Query("token"); q != "" {
		return q, ""
	}
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return parts[1], ""
		}
	}
	return "", ""
}

func isLikelyJWT(s string) bool {
	// Compact JWT: header.payload.signature
	if strings.Count(s, ".") != 2 {
		return false
	}
	return len(s) >= 20
}
