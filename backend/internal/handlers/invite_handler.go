package handlers

import (
	"net/http"
	"net/url"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type InviteHandler struct {
	store *services.InviteStore
	email services.EmailService
}

func NewInviteHandler(store *services.InviteStore, email services.EmailService) *InviteHandler {
	return &InviteHandler{
		store: store,
		email: email,
	}
}

type createInviteRequest struct {
	Email string `json:"email" binding:"required"`
}

func (h *InviteHandler) CreateInvite(c *gin.Context) {
	if h.store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invite store chưa sẵn sàng"})
		return
	}
	var req createInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng nhập email"})
		return
	}

	invitedBy := ""
	if v, ok := c.Get("username"); ok {
		if s, ok := v.(string); ok {
			invitedBy = s
		}
	}

	rawToken, inv, err := h.store.CreateOrRefresh(req.Email, invitedBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	baseURL := publicBaseURL(c, services.AppConfig{})
	inviteLink := baseURL + "/api/invites/accept?token=" + url.QueryEscape(rawToken)

	emailErr := error(nil)
	if h.email != nil {
		if err := h.email.SendInvite(inv.Email, inviteLink); err != nil {
			emailErr = err
		}
	}

	resp := gin.H{
		"email":      inv.Email,
		"status":     inv.Status,
		"expiresAt":  inv.ExpiresAt,
		"inviteLink": inviteLink, // helpful for dev even when email is sent
	}
	if emailErr != nil {
		resp["emailError"] = emailErr.Error()
	}
	c.JSON(http.StatusOK, resp)
}

func (h *InviteHandler) ListInvites(c *gin.Context) {
	if h.store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invite store chưa sẵn sàng"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"invites": h.store.List(),
	})
}

func (h *InviteHandler) RevokeInvite(c *gin.Context) {
	if h.store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invite store chưa sẵn sàng"})
		return
	}
	email := strings.TrimSpace(c.Param("email"))
	email, _ = url.PathUnescape(email)
	inv, err := h.store.Revoke(email)
	if err != nil {
		switch err {
		case services.ErrInviteNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite không tồn tại"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"email":  inv.Email,
		"status": inv.Status,
	})
}

func (h *InviteHandler) AcceptInvite(c *gin.Context) {
	if h.store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invite store chưa sẵn sàng"})
		return
	}
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Thiếu token"})
		return
	}

	_, err := h.store.Accept(token)
	if err != nil {
		switch err {
		case services.ErrInviteNotFound, services.ErrInviteInvalidToken:
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite không hợp lệ"})
		case services.ErrInviteExpired:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invite đã hết hạn"})
		case services.ErrInviteRevoked:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invite đã bị thu hồi"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể chấp nhận invite"})
		}
		return
	}

	baseURL := publicBaseURL(c, services.AppConfig{})
	c.Redirect(http.StatusFound, baseURL+"/#/login?inviteAccepted=1")
}
