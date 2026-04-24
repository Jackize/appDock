package models

import "time"

type TraefikConfig struct {
	Enabled          bool      `json:"enabled"`
	Domain           string    `json:"domain"` // base domain, e.g. example.com
	CloudflareToken  string    `json:"cloudflareToken"`
	ACMEEmail        string    `json:"acmeEmail"`
	DashboardHost    string    `json:"dashboardHost"` // traefik.example.com (optional)
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
	LastApplyOutput  string    `json:"lastApplyOutput,omitempty"`
	LastApplyError   string    `json:"lastApplyError,omitempty"`
	LastAppliedAt    *time.Time `json:"lastAppliedAt,omitempty"`
}

type UpdateTraefikConfigRequest struct {
	Enabled         *bool  `json:"enabled"`
	Domain          string `json:"domain"`
	CloudflareToken string `json:"cloudflareToken"`
	ACMEEmail       string `json:"acmeEmail"`
	DashboardHost   string `json:"dashboardHost"`
}

