package services

import (
	"errors"
	"os"
)

var ErrEmailNotConfigured = errors.New("email service not configured")

type EmailService interface {
	SendInvite(toEmail, inviteLink string) error
}

func NewEmailService() (EmailService, error) {
	provider := os.Getenv("APPDOCK_EMAIL_PROVIDER")
	if provider == "" {
		provider = "sendgrid"
	}

	switch provider {
	case "sendgrid":
		return NewSendGridEmailService()
	default:
		return nil, errors.New("unsupported email provider: " + provider)
	}
}

