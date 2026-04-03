package models

import "time"

type SSLStatus string

const (
	SSLStatusNone    SSLStatus = "none"
	SSLStatusActive  SSLStatus = "active"
	SSLStatusExpired SSLStatus = "expired"
	SSLStatusPending SSLStatus = "pending"
)

type Domain struct {
	ID           string     `json:"id"`
	Domain       string     `json:"domain"`
	UpstreamHost string     `json:"upstreamHost"`
	UpstreamPort int        `json:"upstreamPort"`
	SSLEnabled   bool       `json:"sslEnabled"`
	SSLStatus    SSLStatus  `json:"sslStatus"`
	SSLExpiry    *time.Time `json:"sslExpiry,omitempty"`
	Enabled      bool       `json:"enabled"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type NginxStatus struct {
	Installed        bool   `json:"installed"`
	Running          bool   `json:"running"`
	Version          string `json:"version"`
	ConfigOk         bool   `json:"configOk"`
	CertbotInstalled bool   `json:"certbotInstalled"`
}

type Certificate struct {
	Domain    string    `json:"domain"`
	Issuer    string    `json:"issuer"`
	ExpiresAt time.Time `json:"expiresAt"`
	Path      string    `json:"path"`
	KeyPath   string    `json:"keyPath"`
	AutoRenew bool      `json:"autoRenew"`
}

type CreateDomainRequest struct {
	Domain       string `json:"domain" binding:"required"`
	UpstreamHost string `json:"upstreamHost" binding:"required"`
	UpstreamPort int    `json:"upstreamPort" binding:"required,min=1,max=65535"`
	SSLEnabled   bool   `json:"sslEnabled"`
	SSLEmail     string `json:"sslEmail"`
}

type UpdateDomainRequest struct {
	UpstreamHost *string `json:"upstreamHost,omitempty"`
	UpstreamPort *int    `json:"upstreamPort,omitempty"`
	Enabled      *bool   `json:"enabled,omitempty"`
}

type RequestCertificateRequest struct {
	Domain string `json:"domain" binding:"required"`
	Email  string `json:"email" binding:"required,email"`
}
