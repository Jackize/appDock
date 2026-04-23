package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"
)

type ResendEmailService struct {
	apiKey string
	from   string
	client *http.Client
}

func NewResendEmailService() (*ResendEmailService, error) {
	apiKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	from := strings.TrimSpace(os.Getenv("APPDOCK_EMAIL_FROM"))
	if apiKey == "" || from == "" {
		return nil, ErrEmailNotConfigured
	}
	return &ResendEmailService{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func NewResendEmailServiceWithConfig(store *ConfigStore) (*ResendEmailService, error) {
	cfg := AppConfig{}
	if store != nil {
		cfg = store.Get()
	}
	apiKey := strings.TrimSpace(cfg.ResendAPIKey)
	from := strings.TrimSpace(cfg.EmailFrom)
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	}
	if from == "" {
		from = strings.TrimSpace(os.Getenv("APPDOCK_EMAIL_FROM"))
	}
	if apiKey == "" || from == "" {
		return nil, ErrEmailNotConfigured
	}
	return &ResendEmailService{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (s *ResendEmailService) SendInvite(toEmail, inviteLink string) error {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return errors.New("toEmail is required")
	}
	if inviteLink == "" {
		return errors.New("inviteLink is required")
	}

	subject := "You’ve been invited to AppDock"
	text := "You’ve been invited to AppDock.\n\nOpen this link to accept the invite:\n" + inviteLink + "\n"
	html := `<p>You’ve been invited to AppDock.</p><p><a href="` + inviteLink + `">Accept invite</a></p><p>If the button does not work, open this link:</p><p>` + inviteLink + `</p>`

	body := map[string]any{
		"from":    s.from,
		"to":      []string{toEmail},
		"subject": subject,
		"text":    text,
		"html":    html,
	}
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return errors.New("resend error: statusCode " + itoa(resp.StatusCode))
	}
	return nil
}

func itoa(n int) string {
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

