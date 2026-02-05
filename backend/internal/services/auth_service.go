package services

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

// AuthService xử lý authentication
type AuthService struct {
	username  string
	password  string
	jwtSecret []byte
}

// Claims cho JWT token
type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// NewAuthService tạo AuthService mới
func NewAuthService() *AuthService {
	// Lấy credentials từ environment variables
	username := os.Getenv("APPDOCK_USERNAME")
	if username == "" {
		username = "admin" // Default username
	}

	password := os.Getenv("APPDOCK_PASSWORD")
	if password == "" {
		password = "appdock" // Default password
	}

	jwtSecret := os.Getenv("APPDOCK_JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "appdock-secret-key-change-in-production" // Default secret
	}

	return &AuthService{
		username:  username,
		password:  password,
		jwtSecret: []byte(jwtSecret),
	}
}

// Login xác thực user và trả về JWT token
func (s *AuthService) Login(username, password string) (string, error) {
	// Kiểm tra credentials
	if username != s.username || password != s.password {
		return "", ErrInvalidCredentials
	}

	// Tạo JWT token
	expirationTime := time.Now().Add(24 * time.Hour) // Token hết hạn sau 24h
	claims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "appdock",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// ValidateToken kiểm tra JWT token có hợp lệ không
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Kiểm tra signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.jwtSecret, nil
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
	newTokenString, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", err
	}

	return newTokenString, nil
}

// IsAuthEnabled kiểm tra xem auth có được bật không
func (s *AuthService) IsAuthEnabled() bool {
	disabled := os.Getenv("APPDOCK_AUTH_DISABLED")
	return disabled != "true"
}

// GetCurrentUser trả về username hiện tại (cho display)
func (s *AuthService) GetCurrentUser() string {
	return s.username
}
