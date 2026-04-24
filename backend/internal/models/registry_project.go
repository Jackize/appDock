package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// RegistryProject stores credentials and namespace for a private/OCI registry
// (Harbor-style project: host + namespace + auth).
type RegistryProject struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Host        string    `json:"host"`      // e.g. ghcr.io or registry.example.com:5000
	Namespace   string    `json:"namespace"` // e.g. myorg — images are host/namespace/repo:tag
	Username string `json:"username,omitempty"` // persisted on disk; use ToResponse for API
	Password string `json:"password,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type RegistryProjectResponse struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	Host            string    `json:"host"`
	Namespace       string    `json:"namespace"`
	Username        string    `json:"username,omitempty"`
	HasPassword     bool      `json:"hasPassword"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

func (r *RegistryProject) ToResponse() RegistryProjectResponse {
	return RegistryProjectResponse{
		ID:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		Host:        r.Host,
		Namespace:   r.Namespace,
		Username:    r.Username,
		HasPassword: r.Password != "",
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

// ImageRef returns a pull reference host/namespace/repository:tag
func (r *RegistryProject) ImageRef(repository, tag string) string {
	host := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(r.Host), "/"))
	ns := strings.Trim(strings.TrimSpace(r.Namespace), "/")
	repo := strings.Trim(strings.TrimSpace(repository), "/")
	if tag == "" {
		tag = "latest"
	}
	if ns != "" {
		return host + "/" + ns + "/" + repo + ":" + tag
	}
	return host + "/" + repo + ":" + tag
}

type CreateRegistryProjectRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Host        string `json:"host" binding:"required"`
	Namespace   string `json:"namespace"`
	Username    string `json:"username"`
	Password    string `json:"password"`
}

type UpdateRegistryProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Host        string `json:"host"`
	Namespace   string `json:"namespace"`
	Username    string `json:"username"`
	Password    string `json:"password"` // empty = leave unchanged
}

func NewRegistryProject(req CreateRegistryProjectRequest) *RegistryProject {
	now := time.Now()
	return &RegistryProject{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Host:        strings.TrimSpace(req.Host),
		Namespace:   strings.TrimSpace(req.Namespace),
		Username:    req.Username,
		Password:    req.Password,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}
