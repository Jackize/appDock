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
)

const invitesFile = "invites.json"

var (
	ErrInviteNotFound     = errors.New("invite not found")
	ErrInviteExpired      = errors.New("invite expired")
	ErrInviteRevoked      = errors.New("invite revoked")
	ErrInviteInvalidToken = errors.New("invalid invite token")
)

type InviteStatus string

const (
	InvitePending  InviteStatus = "pending"
	InviteAccepted InviteStatus = "accepted"
	InviteRevoked  InviteStatus = "revoked"
)

type Invite struct {
	Email     string       `json:"email"`
	Status    InviteStatus `json:"status"`
	TokenHash string       `json:"tokenHash,omitempty"`

	CreatedAt  time.Time  `json:"createdAt"`
	ExpiresAt  time.Time  `json:"expiresAt"`
	AcceptedAt *time.Time `json:"acceptedAt,omitempty"`
	RevokedAt  *time.Time `json:"revokedAt,omitempty"`

	InvitedBy string `json:"invitedBy,omitempty"`
}

type InviteStore struct {
	mu       sync.RWMutex
	invites  []*Invite
	filePath string
}

func NewInviteStore(dataDir string) (*InviteStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &InviteStore{
		invites:  make([]*Invite, 0),
		filePath: filepath.Join(dataDir, invitesFile),
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *InviteStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var invites []*Invite
	if err := json.Unmarshal(data, &invites); err != nil {
		return err
	}
	s.invites = invites
	return nil
}

func (s *InviteStore) save() error {
	data, err := json.MarshalIndent(s.invites, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func inviteTTL() time.Duration {
	// Default: 7 days
	if v := os.Getenv("APPDOCK_INVITE_TTL_HOURS"); v != "" {
		if n, err := time.ParseDuration(v + "h"); err == nil && n > 0 {
			return n
		}
	}
	return 7 * 24 * time.Hour
}

func newToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return raw, hash, nil
}

func (s *InviteStore) List() []*Invite {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Invite, 0, len(s.invites))
	for _, inv := range s.invites {
		cp := *inv
		out = append(out, &cp)
	}
	return out
}

func (s *InviteStore) CreateOrRefresh(email, invitedBy string) (rawToken string, invite *Invite, err error) {
	email = normalizeEmail(email)
	if email == "" {
		return "", nil, errors.New("email is required")
	}

	raw, hash, err := newToken()
	if err != nil {
		return "", nil, err
	}

	now := time.Now().UTC()
	exp := now.Add(inviteTTL())

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, inv := range s.invites {
		if inv.Email != email {
			continue
		}
		// Refresh token + expiry, reset state to pending
		inv.Status = InvitePending
		inv.TokenHash = hash
		inv.CreatedAt = now
		inv.ExpiresAt = exp
		inv.AcceptedAt = nil
		inv.RevokedAt = nil
		inv.InvitedBy = invitedBy
		if err := s.save(); err != nil {
			return "", nil, err
		}
		cp := *inv
		return raw, &cp, nil
	}

	inv := &Invite{
		Email:     email,
		Status:    InvitePending,
		TokenHash: hash,
		CreatedAt: now,
		ExpiresAt: exp,
		InvitedBy: invitedBy,
	}
	s.invites = append(s.invites, inv)
	if err := s.save(); err != nil {
		return "", nil, err
	}
	cp := *inv
	return raw, &cp, nil
}

func (s *InviteStore) Accept(rawToken string) (*Invite, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return nil, ErrInviteInvalidToken
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
		if inv.Status == InviteRevoked {
			return nil, ErrInviteRevoked
		}
		if now.After(inv.ExpiresAt) {
			return nil, ErrInviteExpired
		}
		// idempotent accept
		inv.Status = InviteAccepted
		inv.TokenHash = ""
		t := now
		inv.AcceptedAt = &t
		if err := s.save(); err != nil {
			return nil, err
		}
		cp := *inv
		return &cp, nil
	}
	return nil, ErrInviteNotFound
}

func (s *InviteStore) Revoke(email string) (*Invite, error) {
	email = normalizeEmail(email)
	if email == "" {
		return nil, errors.New("email is required")
	}
	now := time.Now().UTC()

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, inv := range s.invites {
		if inv.Email != email {
			continue
		}
		inv.Status = InviteRevoked
		inv.TokenHash = ""
		inv.AcceptedAt = nil
		inv.RevokedAt = &now
		if err := s.save(); err != nil {
			return nil, err
		}
		cp := *inv
		return &cp, nil
	}
	return nil, ErrInviteNotFound
}

func (s *InviteStore) IsEmailAllowed(email string) bool {
	email = normalizeEmail(email)
	if email == "" {
		return false
	}

	now := time.Now().UTC()
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, inv := range s.invites {
		if inv.Email != email {
			continue
		}
		if inv.Status != InviteAccepted {
			return false
		}
		// allow accepted even if ExpiresAt passed? keep strict.
		if now.After(inv.ExpiresAt) {
			return false
		}
		return true
	}
	return false
}

