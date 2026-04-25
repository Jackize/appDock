package models

import (
	"time"

	"github.com/google/uuid"
)

type Environment struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description,omitempty"`
	ServerID    string    `json:"serverId"`
	NetworkName string    `json:"networkName"`
	WorkDir     string    `json:"workDir"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateEnvironmentRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ServerID    string `json:"serverId"`
}

func NewEnvironment(projectID, name, description, serverID, slug, networkName, workDir string) *Environment {
	now := time.Now()
	if serverID == "" {
		serverID = "local"
	}
	return &Environment{
		ID:          uuid.New().String(),
		ProjectID:   projectID,
		Name:        name,
		Slug:        slug,
		Description: description,
		ServerID:    serverID,
		NetworkName: networkName,
		WorkDir:     workDir,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}
