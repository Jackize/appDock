package services

import (
	"errors"
	"os"
	"strings"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

type SendGridEmailService struct {
	apiKey string
	from   *mail.Email
}

func NewSendGridEmailService() (*SendGridEmailService, error) {
	apiKey := strings.TrimSpace(os.Getenv("SENDGRID_API_KEY"))
	from := strings.TrimSpace(os.Getenv("APPDOCK_EMAIL_FROM"))
	if apiKey == "" || from == "" {
		return nil, ErrEmailNotConfigured
	}
	return &SendGridEmailService{
		apiKey: apiKey,
		from:   mail.NewEmail("AppDock", from),
	}, nil
}

func (s *SendGridEmailService) SendInvite(toEmail, inviteLink string) error {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return errors.New("toEmail is required")
	}
	if inviteLink == "" {
		return errors.New("inviteLink is required")
	}

	subject := "You’ve been invited to AppDock"
	plain := "You’ve been invited to AppDock.\n\nOpen this link to accept the invite:\n" + inviteLink + "\n"
	html := `<p>You’ve been invited to AppDock.</p><p><a href="` + inviteLink + `">Accept invite</a></p><p>If the button does not work, open this link:</p><p>` + inviteLink + `</p>`

	to := mail.NewEmail("", toEmail)
	message := mail.NewSingleEmail(s.from, subject, to, plain, html)
	client := sendgrid.NewSendClient(s.apiKey)
	resp, err := client.Send(message)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return errors.New("sendgrid error: statusCode " + itoa(resp.StatusCode))
	}
	return nil
}

func itoa(n int) string {
	// small helper to avoid importing strconv in multiple files
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [12]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

