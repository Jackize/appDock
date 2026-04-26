package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/idtoken"
)

// AuthHandler xử lý các request liên quan đến authentication
type AuthHandler struct {
	authService   *services.AuthService
	inviteStore   *services.InviteStore
	projectAccess *services.ProjectAccessStore
}

// NewAuthHandler tạo AuthHandler mới
func NewAuthHandler(authService *services.AuthService, inviteStore *services.InviteStore, projectAccess ...*services.ProjectAccessStore) *AuthHandler {
	var access *services.ProjectAccessStore
	if len(projectAccess) > 0 {
		access = projectAccess[0]
	}
	return &AuthHandler{
		authService:   authService,
		inviteStore:   inviteStore,
		projectAccess: access,
	}
}

type googleIDTokenClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Sub           string `json:"sub"`
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

// ChangeUsernameRequest request body cho đổi username
type ChangeUsernameRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewUsername     string `json:"newUsername" binding:"required"`
}

// ChangeUsername xử lý đổi username
func (h *AuthHandler) ChangeUsername(c *gin.Context) {
	var req ChangeUsernameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Vui lòng nhập đầy đủ mật khẩu và username mới",
		})
		return
	}

	err := h.authService.ChangeUsername(req.CurrentPassword, req.NewUsername)
	if err != nil {
		switch err {
		case services.ErrInvalidCurrentPassword:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Mật khẩu không đúng",
			})
		case services.ErrUsernameTooShort:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Username mới phải có ít nhất 3 ký tự",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Đã xảy ra lỗi khi đổi username",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Đổi username thành công",
		"username": req.NewUsername,
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

func (h *AuthHandler) GoogleStart(c *gin.Context) {
	clientID := os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Google OAuth chưa được cấu hình"})
		return
	}

	baseURL := publicBaseURL(c)
	redirectURL := baseURL + "/api/auth/google/callback"

	conf := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}

	state, err := randomB64URL(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể tạo state"})
		return
	}

	verifier, err := randomB64URL(64)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể tạo verifier"})
		return
	}
	challenge := pkceChallengeS256(verifier)

	setShortLivedCookie(c, "appdock_oauth_state", state, 300)
	setShortLivedCookie(c, "appdock_oauth_verifier", verifier, 300)

	authURL := conf.AuthCodeURL(
		state,
		oauth2.AccessTypeOnline,
		oauth2.SetAuthURLParam("code_challenge", challenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		oauth2.SetAuthURLParam("prompt", "select_account"),
	)

	c.Redirect(http.StatusFound, authURL)
}

func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	clientID := os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Google OAuth chưa được cấu hình"})
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Thiếu code/state"})
		return
	}

	stateCookie, _ := c.Cookie("appdock_oauth_state")
	verifier, _ := c.Cookie("appdock_oauth_verifier")
	clearCookie(c, "appdock_oauth_state")
	clearCookie(c, "appdock_oauth_verifier")

	if stateCookie == "" || stateCookie != state {
		c.JSON(http.StatusBadRequest, gin.H{"error": "State không hợp lệ"})
		return
	}
	if verifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verifier không hợp lệ"})
		return
	}

	baseURL := publicBaseURL(c)
	redirectURL := baseURL + "/api/auth/google/callback"

	conf := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}

	ctx := c.Request.Context()
	tok, err := conf.Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Không thể đổi code"})
		return
	}

	rawIDToken, _ := tok.Extra("id_token").(string)
	if rawIDToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Thiếu id_token"})
		return
	}

	payload, err := idtoken.Validate(ctx, rawIDToken, clientID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "id_token không hợp lệ"})
		return
	}

	var claims googleIDTokenClaims
	if err := mapToStruct(payload.Claims, &claims); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Không thể đọc claims"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(claims.Email))
	if email == "" || !claims.EmailVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "Email Google chưa được xác minh"})
		return
	}

	// Invite-only gate
	allowedByGlobalInvite := h.inviteStore != nil && h.inviteStore.IsEmailAllowed(email)
	allowedByProjectInvite := h.projectAccess != nil && h.projectAccess.IsEmailProjectMember(email)
	if !allowedByGlobalInvite && !allowedByProjectInvite {
		c.JSON(http.StatusForbidden, gin.H{"error": "Email chưa được mời"})
		return
	}

	appToken, err := h.authService.IssueToken(email, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể tạo token"})
		return
	}

	// Redirect back to frontend (HashRouter) with token.
	frontendURL := baseURL + "/#/auth/callback?token=" + url.QueryEscape(appToken)
	c.Redirect(http.StatusFound, frontendURL)
}

func publicBaseURL(c *gin.Context) string {
	if v := strings.TrimRight(os.Getenv("APPDOCK_PUBLIC_URL"), "/"); v != "" {
		return v
	}
	scheme := "http"
	if xf := c.GetHeader("X-Forwarded-Proto"); xf != "" {
		scheme = xf
	} else if c.Request.TLS != nil {
		scheme = "https"
	}
	host := c.Request.Host
	return scheme + "://" + host
}

func randomB64URL(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func pkceChallengeS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func setShortLivedCookie(c *gin.Context, name, value string, maxAgeSeconds int) {
	c.SetCookie(name, value, maxAgeSeconds, "/", "", c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https", true)
}

func clearCookie(c *gin.Context, name string) {
	c.SetCookie(name, "", -1, "/", "", false, true)
}

func mapToStruct(m map[string]any, out any) error {
	if m == nil {
		return errors.New("nil map")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}
