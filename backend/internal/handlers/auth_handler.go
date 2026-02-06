package handlers

import (
	"net/http"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

// AuthHandler xử lý các request liên quan đến authentication
type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler tạo AuthHandler mới
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// LoginRequest request body cho login
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse response cho login thành công
type LoginResponse struct {
	Token     string `json:"token"`
	Username  string `json:"username"`
	ExpiresIn int    `json:"expiresIn"` // seconds
}

// Login xử lý đăng nhập
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Vui lòng nhập username và password",
		})
		return
	}

	token, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		if err == services.ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Sai tên đăng nhập hoặc mật khẩu",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Đã xảy ra lỗi khi đăng nhập",
		})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token:     token,
		Username:  req.Username,
		ExpiresIn: 86400, // 24 hours in seconds
	})
}

// RefreshToken làm mới token
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// Lấy token từ header
	tokenString := extractToken(c)
	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Token không được cung cấp",
		})
		return
	}

	newToken, err := h.authService.RefreshToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Token không hợp lệ hoặc đã hết hạn",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":     newToken,
		"expiresIn": 86400,
	})
}

// GetMe trả về thông tin user hiện tại
func (h *AuthHandler) GetMe(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Chưa đăng nhập",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"username": username,
	})
}

// GetAuthStatus trả về trạng thái auth (có bật hay không)
func (h *AuthHandler) GetAuthStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"enabled": h.authService.IsAuthEnabled(),
	})
}

// ChangePasswordRequest request body cho đổi mật khẩu
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword" binding:"required"`
}

// ChangePassword xử lý đổi mật khẩu
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới",
		})
		return
	}

	err := h.authService.ChangePassword(req.CurrentPassword, req.NewPassword)
	if err != nil {
		switch err {
		case services.ErrInvalidCurrentPassword:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Mật khẩu hiện tại không đúng",
			})
		case services.ErrPasswordTooShort:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Mật khẩu mới phải có ít nhất 6 ký tự",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Đã xảy ra lỗi khi đổi mật khẩu",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Đổi mật khẩu thành công",
	})
}

// extractToken lấy token từ Authorization header
func extractToken(c *gin.Context) string {
	bearerToken := c.GetHeader("Authorization")
	if len(bearerToken) > 7 && bearerToken[:7] == "Bearer " {
		return bearerToken[7:]
	}
	return ""
}
