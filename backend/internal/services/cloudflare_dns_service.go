package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type CloudflareDNSService struct {
	httpClient *http.Client
	baseURL    string
}

func NewCloudflareDNSService() *CloudflareDNSService {
	return &CloudflareDNSService{
		httpClient: &http.Client{Timeout: 20 * time.Second},
		baseURL:    "https://api.cloudflare.com/client/v4",
	}
}

type CloudflareZone struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CloudflareDNSRecord struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"`
	Name     string  `json:"name"`
	Content  string  `json:"content"`
	Proxied  *bool   `json:"proxied,omitempty"`
	TTL      int     `json:"ttl"`
	Priority *int    `json:"priority,omitempty"`
	Comment  *string `json:"comment,omitempty"`
	Created  string  `json:"created_on,omitempty"`
	Modified string  `json:"modified_on,omitempty"`
}

type CloudflareCreateDNSRecordRequest struct {
	Type     string  `json:"type"`
	Name     string  `json:"name"`
	Content  string  `json:"content"`
	TTL      *int    `json:"ttl,omitempty"`
	Proxied  *bool   `json:"proxied,omitempty"`
	Priority *int    `json:"priority,omitempty"`
	Comment  *string `json:"comment,omitempty"`
}

type CloudflareUpdateDNSRecordRequest struct {
	Type     string  `json:"type"`
	Name     string  `json:"name"`
	Content  string  `json:"content"`
	TTL      *int    `json:"ttl,omitempty"`
	Proxied  *bool   `json:"proxied,omitempty"`
	Priority *int    `json:"priority,omitempty"`
	Comment  *string `json:"comment,omitempty"`
}

type cloudflareError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type cloudflareResponse[T any] struct {
	Success bool              `json:"success"`
	Errors  []cloudflareError `json:"errors"`
	Result  T                 `json:"result"`
}

type CloudflareAuth struct {
	// Preferred (recommended): API token
	Token string

	// Alternative: global API key + email
	Email  string
	APIKey string
}

func (a CloudflareAuth) isEmpty() bool {
	return a.Token == "" && (a.Email == "" || a.APIKey == "")
}

func (s *CloudflareDNSService) do(ctx context.Context, auth CloudflareAuth, method, path string, query url.Values, body any, out any) error {
	if auth.isEmpty() {
		return fmt.Errorf("missing Cloudflare credentials (token or email+api key)")
	}

	u := s.baseURL + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}

	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, u, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	if auth.Token != "" {
		req.Header.Set("Authorization", "Bearer "+auth.Token)
	} else {
		req.Header.Set("X-Auth-Email", auth.Email)
		req.Header.Set("X-Auth-Key", auth.APIKey)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Try to surface Cloudflare error message when possible
		var cfErr cloudflareResponse[json.RawMessage]
		if err := json.Unmarshal(b, &cfErr); err == nil && len(cfErr.Errors) > 0 {
			return fmt.Errorf("cloudflare: %s", cfErr.Errors[0].Message)
		}
		return fmt.Errorf("cloudflare http %d", resp.StatusCode)
	}

	if out == nil {
		return nil
	}
	return json.Unmarshal(b, out)
}

type CloudflareTokenVerifyResult struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	NotBefore string `json:"not_before"`
	ExpiresOn string `json:"expires_on"`
}

type CloudflareUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func (s *CloudflareDNSService) Verify(ctx context.Context, auth CloudflareAuth) (map[string]any, error) {
	// Token path: /user/tokens/verify
	if auth.Token != "" {
		var resp cloudflareResponse[CloudflareTokenVerifyResult]
		if err := s.do(ctx, auth, http.MethodGet, "/user/tokens/verify", nil, nil, &resp); err != nil {
			return nil, err
		}
		return map[string]any{
			"method": "token",
			"token":  resp.Result,
		}, nil
	}

	// Global key path: GET /user
	var resp cloudflareResponse[CloudflareUser]
	if err := s.do(ctx, auth, http.MethodGet, "/user", nil, nil, &resp); err != nil {
		return nil, err
	}
	return map[string]any{
		"method": "global_key",
		"user":   resp.Result,
	}, nil
}

func (s *CloudflareDNSService) ListZones(ctx context.Context, auth CloudflareAuth, name string) ([]CloudflareZone, error) {
	q := url.Values{}
	if name != "" {
		q.Set("name", name)
	}
	var resp cloudflareResponse[[]CloudflareZone]
	if err := s.do(ctx, auth, http.MethodGet, "/zones", q, nil, &resp); err != nil {
		return nil, err
	}
	if !resp.Success {
		return nil, fmt.Errorf("cloudflare: request failed")
	}
	return resp.Result, nil
}

func (s *CloudflareDNSService) ListDNSRecords(ctx context.Context, auth CloudflareAuth, zoneID string, recordType string, recordName string) ([]CloudflareDNSRecord, error) {
	if zoneID == "" {
		return nil, fmt.Errorf("missing zone id")
	}
	q := url.Values{}
	if recordType != "" {
		q.Set("type", recordType)
	}
	if recordName != "" {
		q.Set("name", recordName)
	}
	var resp cloudflareResponse[[]CloudflareDNSRecord]
	if err := s.do(ctx, auth, http.MethodGet, "/zones/"+zoneID+"/dns_records", q, nil, &resp); err != nil {
		return nil, err
	}
	if !resp.Success {
		return nil, fmt.Errorf("cloudflare: request failed")
	}
	return resp.Result, nil
}

func (s *CloudflareDNSService) CreateDNSRecord(ctx context.Context, auth CloudflareAuth, zoneID string, req CloudflareCreateDNSRecordRequest) (*CloudflareDNSRecord, error) {
	if zoneID == "" {
		return nil, fmt.Errorf("missing zone id")
	}
	var resp cloudflareResponse[CloudflareDNSRecord]
	if err := s.do(ctx, auth, http.MethodPost, "/zones/"+zoneID+"/dns_records", nil, req, &resp); err != nil {
		return nil, err
	}
	if !resp.Success {
		return nil, fmt.Errorf("cloudflare: request failed")
	}
	return &resp.Result, nil
}

func (s *CloudflareDNSService) UpdateDNSRecord(ctx context.Context, auth CloudflareAuth, zoneID, recordID string, req CloudflareUpdateDNSRecordRequest) (*CloudflareDNSRecord, error) {
	if zoneID == "" || recordID == "" {
		return nil, fmt.Errorf("missing zone id or record id")
	}
	var resp cloudflareResponse[CloudflareDNSRecord]
	if err := s.do(ctx, auth, http.MethodPut, "/zones/"+zoneID+"/dns_records/"+recordID, nil, req, &resp); err != nil {
		return nil, err
	}
	if !resp.Success {
		return nil, fmt.Errorf("cloudflare: request failed")
	}
	return &resp.Result, nil
}

func (s *CloudflareDNSService) DeleteDNSRecord(ctx context.Context, auth CloudflareAuth, zoneID, recordID string) error {
	if zoneID == "" || recordID == "" {
		return fmt.Errorf("missing zone id or record id")
	}
	// Cloudflare returns result object; we don't need it.
	var resp cloudflareResponse[json.RawMessage]
	if err := s.do(ctx, auth, http.MethodDelete, "/zones/"+zoneID+"/dns_records/"+recordID, nil, nil, &resp); err != nil {
		return err
	}
	if !resp.Success {
		return fmt.Errorf("cloudflare: request failed")
	}
	return nil
}
