package models

import (
	"time"

	"github.com/google/uuid"
)

// ComposeStack is a stored compose file set deployed with docker compose on a host.
type ComposeStack struct {
	ID                 string    `json:"id"`
	ProjectID          string    `json:"projectId"`
	ServerID           string    `json:"serverId"`
	Name               string    `json:"name"`
	ComposeProjectName string    `json:"composeProjectName"` // docker compose -p
	ComposeYAML        string    `json:"composeYaml"`
	EnvContent         string    `json:"envContent,omitempty"`
	LastDeployAt       *time.Time `json:"lastDeployAt,omitempty"`
	LastDeployMessage  string    `json:"lastDeployMessage,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type CreateComposeStackRequest struct {
	ProjectID          string `json:"projectId" binding:"required"`
	ServerID           string `json:"serverId"`
	Name               string `json:"name" binding:"required"`
	ComposeProjectName string `json:"composeProjectName" binding:"required"`
	ComposeYAML        string `json:"composeYaml" binding:"required"`
	EnvContent         string `json:"envContent"`
}

type UpdateComposeStackRequest struct {
	Name               string `json:"name"`
	ComposeProjectName string `json:"composeProjectName"`
	ComposeYAML        string `json:"composeYaml"`
	EnvContent         string `json:"envContent"`
	ServerID           string `json:"serverId"`
}

func NewComposeStack(req CreateComposeStackRequest) *ComposeStack {
	now := time.Now()
	sid := req.ServerID
	if sid == "" {
		sid = "local"
	}
	return &ComposeStack{
		ID:                 uuid.New().String(),
		ProjectID:          req.ProjectID,
		ServerID:           sid,
		Name:               req.Name,
		ComposeProjectName: req.ComposeProjectName,
		ComposeYAML:        req.ComposeYAML,
		EnvContent:         req.EnvContent,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}
