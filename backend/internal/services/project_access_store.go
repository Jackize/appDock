package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"appdock/internal/models"

	"github.com/google/uuid"
)

var (
	ErrProjectInviteNotFound = errors.New("project invite not found")
	ErrProjectInviteExpired  = errors.New("project invite expired")
	ErrProjectAccessDenied   = errors.New("project access denied")
)

type ProjectAccessStore struct {
	mu       sync.RWMutex
	members  map[string]*models.ProjectMember
	invites  map[string]*models.ProjectInvite
	filePath string
}

type projectAccessDisk struct {
	Members []*models.ProjectMember `json:"members"`
	Invites []*models.ProjectInvite `json:"invites"`
}

type ProjectIdentity struct {
	Username string
	Email    string
}

func NewProjectAccessStore(dataDir string) (*ProjectAccessStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &ProjectAccessStore{
		members:  make(map[string]*models.ProjectMember),
		invites:  make(map[string]*models.ProjectInvite),
		filePath: filepath.Join(dataDir, "project_access.json"),
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *ProjectAccessStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var disk projectAccessDisk
	if err := json.Unmarshal(data, &disk); err != nil {
		return err
	}
	for _, m := range disk.Members {
		s.members[m.ID] = m
	}
	for _, inv := range disk.Invites {
		s.invites[inv.ID] = inv
	}
	return nil
}

func (s *ProjectAccessStore) save() error {
	disk := projectAccessDisk{
		Members: make([]*models.ProjectMember, 0, len(s.members)),
		Invites: make([]*models.ProjectInvite, 0, len(s.invites)),
	}
	for _, m := range s.members {
		disk.Members = append(disk.Members, m)
	}
	for _, inv := range s.invites {
		disk.Invites = append(disk.Invites, inv)
	}
	data, err := json.MarshalIndent(disk, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0600)
}

func (s *ProjectAccessStore) EnsureOwner(projectID string, ident ProjectIdentity) error {
	if ident.Username == "" && ident.Email == "" {
		ident.Username = "admin"
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, m := range s.members {
		if m.ProjectID != projectID {
			continue
		}
		if identityMatchesMember(ident, m) {
			if m.Role != models.ProjectRoleOwner {
				m.Role = models.ProjectRoleOwner
				m.UpdatedAt = time.Now()
				return s.save()
			}
			return nil
		}
	}
	now := time.Now()
	member := &models.ProjectMember{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Email:     normalizeEmail(ident.Email),
		Username:  strings.TrimSpace(ident.Username),
		Role:      models.ProjectRoleOwner,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.members[member.ID] = member
	return s.save()
}

func (s *ProjectAccessStore) EnsureLegacyOwner(projectID string) error {
	return s.EnsureOwner(projectID, ProjectIdentity{Username: "admin"})
}

func (s *ProjectAccessStore) ListMembers(projectID string) []*models.ProjectMember {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.ProjectMember, 0)
	for _, m := range s.members {
		if m.ProjectID == projectID {
			cp := *m
			out = append(out, &cp)
		}
	}
	return out
}

func (s *ProjectAccessStore) HasAnyMember(projectID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, m := range s.members {
		if m.ProjectID == projectID {
			return true
		}
	}
	return false
}

func (s *ProjectAccessStore) Can(projectID string, ident ProjectIdentity, minRole models.ProjectRole) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, m := range s.members {
		if m.ProjectID != projectID || !identityMatchesMember(ident, m) {
			continue
		}
		return roleRank(m.Role) >= roleRank(minRole)
	}
	return false
}

func (s *ProjectAccessStore) IsEmailProjectMember(email string) bool {
	email = normalizeEmail(email)
	if email == "" {
		return false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, m := range s.members {
		if normalizeEmail(m.Email) == email {
			return true
		}
	}
	return false
}

func (s *ProjectAccessStore) CreateInvite(projectID string, email string, role models.ProjectRole, invitedBy string) (rawToken string, invite *models.ProjectInvite, err error) {
	email = normalizeEmail(email)
	if email == "" {
		return "", nil, errors.New("email is required")
	}
	if !validRole(role) || role == models.ProjectRoleOwner {
		return "", nil, errors.New("role must be deployer or viewer")
	}
	raw, hash, err := projectInviteToken()
	if err != nil {
		return "", nil, err
	}
	now := time.Now().UTC()
	expires := now.Add(inviteTTL())
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, inv := range s.invites {
		if inv.ProjectID == projectID && normalizeEmail(inv.Email) == email {
			inv.Role = role
			inv.TokenHash = hash
			inv.Status = "pending"
			inv.InvitedBy = invitedBy
			inv.CreatedAt = now
			inv.ExpiresAt = expires
			inv.AcceptedAt = nil
			if err := s.save(); err != nil {
				return "", nil, err
			}
			cp := *inv
			return raw, &cp, nil
		}
	}
	inv := &models.ProjectInvite{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Email:     email,
		Role:      role,
		TokenHash: hash,
		Status:    "pending",
		InvitedBy: invitedBy,
		CreatedAt: now,
		ExpiresAt: expires,
	}
	s.invites[inv.ID] = inv
	if err := s.save(); err != nil {
		return "", nil, err
	}
	cp := *inv
	return raw, &cp, nil
}

func (s *ProjectAccessStore) AcceptInvite(rawToken string) (*models.ProjectInvite, *models.ProjectMember, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return nil, nil, ErrProjectInviteNotFound
	}
	sum := sha256.Sum256([]byte(rawToken))
	hash := hex.EncodeToString(sum[:])
	now := time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, inv := range s.invites {
		if inv.TokenHash != hash {
			continue
		}
		if now.After(inv.ExpiresAt) {
			return nil, nil, ErrProjectInviteExpired
		}
		inv.Status = "accepted"
		inv.TokenHash = ""
		inv.AcceptedAt = &now
		member := s.upsertMemberLocked(inv.ProjectID, inv.Email, "", inv.Role, inv.InvitedBy)
		if err := s.save(); err != nil {
			return nil, nil, err
		}
		invCopy := *inv
		memCopy := *member
		return &invCopy, &memCopy, nil
	}
	return nil, nil, ErrProjectInviteNotFound
}

func (s *ProjectAccessStore) upsertMemberLocked(projectID, email, username string, role models.ProjectRole, invitedBy string) *models.ProjectMember {
	email = normalizeEmail(email)
	username = strings.TrimSpace(username)
	now := time.Now().UTC()
	for _, m := range s.members {
		if m.ProjectID != projectID {
			continue
		}
		if (email != "" && normalizeEmail(m.Email) == email) || (username != "" && m.Username == username) {
			m.Email = email
			if username != "" {
				m.Username = username
			}
			m.Role = role
			m.UpdatedAt = now
			return m
		}
	}
	m := &models.ProjectMember{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Email:     email,
		Username:  username,
		Role:      role,
		InvitedBy: invitedBy,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.members[m.ID] = m
	return m
}

func roleRank(role models.ProjectRole) int {
	switch role {
	case models.ProjectRoleOwner:
		return 3
	case models.ProjectRoleDeployer:
		return 2
	case models.ProjectRoleViewer:
		return 1
	default:
		return 0
	}
}

func validRole(role models.ProjectRole) bool {
	return role == models.ProjectRoleOwner || role == models.ProjectRoleDeployer || role == models.ProjectRoleViewer
}

func identityMatchesMember(ident ProjectIdentity, m *models.ProjectMember) bool {
	email := normalizeEmail(ident.Email)
	if email != "" && normalizeEmail(m.Email) == email {
		return true
	}
	username := strings.TrimSpace(ident.Username)
	return username != "" && strings.TrimSpace(m.Username) == username
}

func projectInviteToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return raw, hash, nil
}
