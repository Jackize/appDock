package models

import (
	"time"

	"github.com/google/uuid"
)

// Project groups logical deployments on a Docker host (similar to a Harbor project
// or a Coolify application workspace).
type Project struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Description         string    `json:"description"`
	ServerID            string    `json:"serverId"`
	RegistryProjectID   string    `json:"registryProjectId,omitempty"`
	ComposeProjectNames []string  `json:"composeProjectNames"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

type CreateProjectRequest struct {
	Name                string   `json:"name" binding:"required"`
	Description         string   `json:"description"`
	ServerID            string   `json:"serverId"`
	RegistryProjectID   string   `json:"registryProjectId"`
	ComposeProjectNames []string `json:"composeProjectNames"`
}

type UpdateProjectRequest struct {
	Name                string   `json:"name"`
	Description         string   `json:"description"`
	ServerID            string   `json:"serverId"`
	RegistryProjectID   *string  `json:"registryProjectId"`
	ComposeProjectNames []string `json:"composeProjectNames"`
}

func NewProject(name, description, serverID string, composeNames []string) *Project {
	now := time.Now()
	if serverID == "" {
		serverID = "local"
	}
	return &Project{
		ID:                  uuid.New().String(),
		Name:                name,
		Description:         description,
		ServerID:            serverID,
		RegistryProjectID:   "",
		ComposeProjectNames: composeNames,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
}
