package models

import (
	"time"

	"github.com/google/uuid"
)

type ResourceType string

const (
	ResourceTypeCompose ResourceType = "compose"
	ResourceTypeImage   ResourceType = "image"
	ResourceTypeCatalog ResourceType = "catalog"
)

type ResourceStatus string

const (
	ResourceStatusIdle      ResourceStatus = "idle"
	ResourceStatusDeploying ResourceStatus = "deploying"
	ResourceStatusDeployed  ResourceStatus = "deployed"
	ResourceStatusError     ResourceStatus = "error"
	ResourceStatusStopped   ResourceStatus = "stopped"
)

type Resource struct {
	ID                 string         `json:"id"`
	ProjectID          string         `json:"projectId"`
	EnvironmentID      string         `json:"environmentId"`
	ServerID           string         `json:"serverId"`
	Name               string         `json:"name"`
	Slug               string         `json:"slug"`
	Description        string         `json:"description,omitempty"`
	Type               ResourceType   `json:"type"`
	Status             ResourceStatus `json:"status"`
	ComposeProjectName string         `json:"composeProjectName"`
	WorkDir            string         `json:"workDir"`

	CatalogAppID string   `json:"catalogAppId,omitempty"`
	Image        string   `json:"image,omitempty"`
	Command      string   `json:"command,omitempty"`
	Volumes      []string `json:"volumes,omitempty"`

	ComposeYAML string `json:"composeYaml,omitempty"`
	EnvContent  string `json:"envContent,omitempty"`

	ServiceName  string `json:"serviceName,omitempty"`
	HasHTTP      bool   `json:"hasHttp"`
	Domain       string `json:"domain,omitempty"`
	InternalPort int    `json:"internalPort,omitempty"`
	IsDatabase   bool   `json:"isDatabase"`

	LastDeployAt      *time.Time `json:"lastDeployAt,omitempty"`
	LastDeployMessage string     `json:"lastDeployMessage,omitempty"`
	LastDeployError   string     `json:"lastDeployError,omitempty"`
	LegacyStackID     string     `json:"legacyStackId,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

type CreateResourceRequest struct {
	Name         string       `json:"name" binding:"required"`
	Description  string       `json:"description"`
	Type         ResourceType `json:"type" binding:"required"`
	CatalogAppID string       `json:"catalogAppId"`
	Image        string       `json:"image"`
	Command      string       `json:"command"`
	Volumes      []string     `json:"volumes"`
	ComposeYAML  string       `json:"composeYaml"`
	EnvContent   string       `json:"envContent"`
	ServiceName  string       `json:"serviceName"`
	HasHTTP      bool         `json:"hasHttp"`
	Domain       string       `json:"domain"`
	InternalPort int          `json:"internalPort"`
	IsDatabase   bool         `json:"isDatabase"`
}

type UpdateResourceRequest struct {
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	Type         ResourceType `json:"type"`
	CatalogAppID string       `json:"catalogAppId"`
	Image        string       `json:"image"`
	Command      string       `json:"command"`
	Volumes      []string     `json:"volumes"`
	ComposeYAML  string       `json:"composeYaml"`
	EnvContent   string       `json:"envContent"`
	ServiceName  string       `json:"serviceName"`
	HasHTTP      *bool        `json:"hasHttp"`
	Domain       string       `json:"domain"`
	InternalPort int          `json:"internalPort"`
	IsDatabase   *bool        `json:"isDatabase"`
}

func NewResource(projectID, environmentID, serverID, name, slug, composeProjectName, workDir string, req CreateResourceRequest) *Resource {
	now := time.Now()
	if serverID == "" {
		serverID = "local"
	}
	return &Resource{
		ID:                 uuid.New().String(),
		ProjectID:          projectID,
		EnvironmentID:      environmentID,
		ServerID:           serverID,
		Name:               name,
		Slug:               slug,
		Description:        req.Description,
		Type:               req.Type,
		Status:             ResourceStatusIdle,
		ComposeProjectName: composeProjectName,
		WorkDir:            workDir,
		CatalogAppID:       req.CatalogAppID,
		Image:              req.Image,
		Command:            req.Command,
		Volumes:            req.Volumes,
		ComposeYAML:        req.ComposeYAML,
		EnvContent:         req.EnvContent,
		ServiceName:        req.ServiceName,
		HasHTTP:            req.HasHTTP,
		Domain:             req.Domain,
		InternalPort:       req.InternalPort,
		IsDatabase:         req.IsDatabase,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}
