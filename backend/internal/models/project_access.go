package models

import "time"

type ProjectRole string

const (
	ProjectRoleOwner    ProjectRole = "owner"
	ProjectRoleDeployer ProjectRole = "deployer"
	ProjectRoleViewer   ProjectRole = "viewer"
)

type ProjectMember struct {
	ID        string      `json:"id"`
	ProjectID string      `json:"projectId"`
	Email     string      `json:"email,omitempty"`
	Username  string      `json:"username,omitempty"`
	Role      ProjectRole `json:"role"`
	InvitedBy string      `json:"invitedBy,omitempty"`
	CreatedAt time.Time   `json:"createdAt"`
	UpdatedAt time.Time   `json:"updatedAt"`
}

type ProjectInvite struct {
	ID         string      `json:"id"`
	ProjectID  string      `json:"projectId"`
	Email      string      `json:"email"`
	Role       ProjectRole `json:"role"`
	TokenHash  string      `json:"tokenHash,omitempty"`
	Status     string      `json:"status"`
	InvitedBy  string      `json:"invitedBy,omitempty"`
	CreatedAt  time.Time   `json:"createdAt"`
	ExpiresAt  time.Time   `json:"expiresAt"`
	AcceptedAt *time.Time  `json:"acceptedAt,omitempty"`
}

type CreateProjectInviteRequest struct {
	Email string      `json:"email" binding:"required"`
	Role  ProjectRole `json:"role" binding:"required"`
}
