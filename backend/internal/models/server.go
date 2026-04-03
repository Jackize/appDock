package models

import (
	"time"

	"github.com/google/uuid"
)

type ServerStatus string

const (
	ServerStatusOnline  ServerStatus = "online"
	ServerStatusOffline ServerStatus = "offline"
	ServerStatusUnknown ServerStatus = "unknown"
)

type Server struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Host      string       `json:"host"`      // e.g., "http://192.168.1.100:9090" or "local"
	APIKey    string       `json:"apiKey"`    // Agent API key (not shown in responses)
	IsLocal   bool         `json:"isLocal"`   // true for local server
	IsDefault bool         `json:"isDefault"` // default server to show
	Status    ServerStatus `json:"status"`
	CreatedAt time.Time    `json:"createdAt"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

type ServerResponse struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Host      string       `json:"host"`
	IsLocal   bool         `json:"isLocal"`
	IsDefault bool         `json:"isDefault"`
	Status    ServerStatus `json:"status"`
	CreatedAt time.Time    `json:"createdAt"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

func (s *Server) ToResponse() ServerResponse {
	return ServerResponse{
		ID:        s.ID,
		Name:      s.Name,
		Host:      s.Host,
		IsLocal:   s.IsLocal,
		IsDefault: s.IsDefault,
		Status:    s.Status,
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
	}
}

type CreateServerRequest struct {
	Name   string `json:"name" binding:"required"`
	Host   string `json:"host" binding:"required"`
	APIKey string `json:"apiKey" binding:"required"`
}

type UpdateServerRequest struct {
	Name      string `json:"name"`
	Host      string `json:"host"`
	APIKey    string `json:"apiKey"`
	IsDefault bool   `json:"isDefault"`
}

func NewServer(name, host, apiKey string) *Server {
	now := time.Now()
	return &Server{
		ID:        uuid.New().String(),
		Name:      name,
		Host:      host,
		APIKey:    apiKey,
		IsLocal:   false,
		IsDefault: false,
		Status:    ServerStatusUnknown,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func NewLocalServer() *Server {
	now := time.Now()
	return &Server{
		ID:        "local",
		Name:      "Local Server",
		Host:      "local",
		APIKey:    "",
		IsLocal:   true,
		IsDefault: true,
		Status:    ServerStatusOnline,
		CreatedAt: now,
		UpdatedAt: now,
	}
}
