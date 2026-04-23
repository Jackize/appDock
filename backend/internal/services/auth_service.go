package services

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidCredentials     = errors.New("invalid username or password")
	ErrInvalidToken           = errors.New("invalid or expired token")
	ErrInvalidCurrentPassword = errors.New("invalid current password")
	ErrPasswordTooShort       = errors.New("password must be at least 6 characters")
	ErrUsernameTooShort       = errors.New("username must be at least 3 characters")
)

// AuthService xử lý authentication
type AuthService struct {
	configStore *ConfigStore
}

// Claims cho JWT token
type Claims struct {
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Provider string `json:"provider,omitempty"`
	jwt.RegisteredClaims
}

// NewAuthService tạo AuthService mới
func NewAuthService() *AuthService {
	return &AuthService{configStore: nil}
}

func NewAuthServiceWithConfig(store *ConfigStore) *AuthService {
	return &AuthService{configStore: store}
}

func (s *AuthService) currentConfig() AppConfig {
	if s.configStore != nil {
		return s.configStore.Get()
	}
	return AppConfig{}
}

func (s *AuthService) getUsername() string {
	cfg := s.currentConfig()
	if strings.TrimSpace(cfg.Username) != "" {
		return strings.TrimSpace(cfg.Username)
	}
	username := os.Getenv("APPDOCK_USERNAME")
	if strings.TrimSpace(username) == "" {
		return "admin"
	}
	return strings.TrimSpace(username)
}

func (s *AuthService) getPassword() string {
	cfg := s.currentConfig()
	if cfg.Password != "" {
		return cfg.Password
	}
	password := os.Getenv("APPDOCK_PASSWORD")
	if password == "" {
		return "appdock"
	}
	return password
}

func (s *AuthService) getJWTSecret() []byte {
	cfg := s.currentConfig()
	if strings.TrimSpace(cfg.JWTSecret) != "" {
		return []byte(strings.TrimSpace(cfg.JWTSecret))
	}
	jwtSecret := os.Getenv("APPDOCK_JWT_SECRET")
	if strings.TrimSpace(jwtSecret) == "" {
		jwtSecret = "appdock-secret-key-change-in-production"
	}
	return []byte(strings.TrimSpace(jwtSecret))
}

// Login xác thực user và trả về JWT token
func (s *AuthService) Login(username, password string) (string, error) {
	// Kiểm tra credentials
	if username != s.getUsername() || password != s.getPassword() {
		return "", ErrInvalidCredentials
	}

	return s.IssueToken(username, "")
}

// IssueToken phát hành JWT token cho một user (dùng cho cả local login và OAuth).
func (s *AuthService) IssueToken(username, email string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour) // Token hết hạn sau 24h
	claims := &Claims{
		Username: username,
		Email:    email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "appdock",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.getJWTSecret())
}

// ValidateToken kiểm tra JWT token có hợp lệ không
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Kiểm tra signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.getJWTSecret(), nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// RefreshToken làm mới token (extend expiration time)
func (s *AuthService) RefreshToken(tokenString string) (string, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return "", err
	}

	// Tạo token mới với thời hạn mới
	expirationTime := time.Now().Add(24 * time.Hour)
	claims.ExpiresAt = jwt.NewNumericDate(expirationTime)
	claims.IssuedAt = jwt.NewNumericDate(time.Now())

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	newTokenString, err := token.SignedString(s.getJWTSecret())
	if err != nil {
		return "", err
	}

	return newTokenString, nil
}

// IsAuthEnabled kiểm tra xem auth có được bật không
func (s *AuthService) IsAuthEnabled() bool {
	cfg := s.currentConfig()
	if cfg.AuthDisabled != nil {
		return !*cfg.AuthDisabled
	}
	disabled := os.Getenv("APPDOCK_AUTH_DISABLED")
	return strings.TrimSpace(disabled) != "true"
}

// GetCurrentUser trả về username hiện tại (cho display)
func (s *AuthService) GetCurrentUser() string {
	return s.getUsername()
}

// IsAdminClaims returns true if the token belongs to the configured admin user.
// Today AppDock treats the "admin" identity as the configured APPDOCK_USERNAME/config username.
func (s *AuthService) IsAdminClaims(claims *Claims) bool {
	if claims == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(claims.Username), strings.TrimSpace(s.getUsername()))
}

// ChangePassword đổi mật khẩu
func (s *AuthService) ChangePassword(currentPassword, newPassword string) error {
	// Kiểm tra mật khẩu hiện tại
	if currentPassword != s.getPassword() {
		return ErrInvalidCurrentPassword
	}

	// Kiểm tra độ dài password mới
	if len(newPassword) < 6 {
		return ErrPasswordTooShort
	}

	// Persist password if config store is enabled
	if s.configStore != nil {
		_, err := s.configStore.Patch(AppConfig{Password: newPassword})
		return err
	}

	return nil
}

// ChangeUsername đổi username
func (s *AuthService) ChangeUsername(currentPassword, newUsername string) error {
	// Kiểm tra mật khẩu hiện tại
	if currentPassword != s.getPassword() {
		return ErrInvalidCurrentPassword
	}

	// Kiểm tra độ dài username mới
	if len(newUsername) < 3 {
		return ErrUsernameTooShort
	}

	// Persist username if config store is enabled
	if s.configStore != nil {
		_, err := s.configStore.Patch(AppConfig{Username: newUsername})
		return err
	}

	return nil
}
