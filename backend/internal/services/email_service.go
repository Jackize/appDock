package services

import (
	"errors"
	"os"
	"strings"
)

var ErrEmailNotConfigured = errors.New("email service not configured")

type EmailService interface {
	SendInvite(toEmail, inviteLink string) error
}

func NewEmailService() (EmailService, error) {
	provider := os.Getenv("APPDOCK_EMAIL_PROVIDER")
	if provider == "" {
		provider = "resend"
	}

	switch provider {
	case "resend":
		return NewResendEmailService()
	default:
		return nil, errors.New("unsupported email provider: " + provider)
	}
}

func NewEmailServiceWithConfig(store *ConfigStore) (EmailService, error) {
	cfg := AppConfig{}
	if store != nil {
		cfg = store.Get()
	}

	provider := strings.TrimSpace(cfg.EmailProvider)
	if provider == "" {
		provider = os.Getenv("APPDOCK_EMAIL_PROVIDER")
	}
	if strings.TrimSpace(provider) == "" {
		provider = "resend"
	}

	switch provider {
	case "resend":
		return NewResendEmailServiceWithConfig(store)
	default:
		return nil, errors.New("unsupported email provider: " + provider)
	}
}

