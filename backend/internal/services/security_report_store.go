package services

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const securityReportsFile = "security_reports.json"
const maxSecurityReports = 500

var ErrSecurityReportNotFound = errors.New("security report not found")

type SecurityReportStatus string

const (
	ReportOpen          SecurityReportStatus = "open"
	ReportAcknowledged  SecurityReportStatus = "acknowledged"
	ReportResolved      SecurityReportStatus = "resolved"
)

type SecurityReport struct {
	ID                   string               `json:"id"`
	ServerID             string               `json:"serverId"`
	CreatedAt            time.Time            `json:"createdAt"`
	Severity             string               `json:"severity"`
	Title                string               `json:"title"`
	Source               string               `json:"source"`
	MetricsSnapshot      json.RawMessage      `json:"metricsSnapshot"`
	DeltaSummary         string               `json:"deltaSummary,omitempty"`
	HeuristicNotes       string               `json:"heuristicNotes,omitempty"`
	AISummary            string               `json:"aiSummary,omitempty"`
	AIEvidence           string               `json:"aiEvidence,omitempty"`
	AIAttackHypothesis   string               `json:"aiAttackHypothesis,omitempty"`
	AIConfidence         float64              `json:"aiConfidence,omitempty"`
	RecommendedActions   []string             `json:"recommendedActions,omitempty"`
	AIResponseRaw        string               `json:"aiResponseRaw,omitempty"`
	Status               SecurityReportStatus `json:"status"`
	Notes                string               `json:"notes,omitempty"`
}

type SecurityReportStore struct {
	mu       sync.RWMutex
	reports  []*SecurityReport
	filePath string
}

func NewSecurityReportStore(dataDir string) (*SecurityReportStore, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &SecurityReportStore{
		reports:  make([]*SecurityReport, 0),
		filePath: filepath.Join(dataDir, securityReportsFile),
	}
	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *SecurityReportStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	var reports []*SecurityReport
	if err := json.Unmarshal(data, &reports); err != nil {
		return err
	}
	s.reports = reports
	return nil
}

func (s *SecurityReportStore) save() error {
	data, err := json.MarshalIndent(s.reports, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *SecurityReportStore) List(serverID, severity, status string) []*SecurityReport {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*SecurityReport, 0, len(s.reports))
	for i := len(s.reports) - 1; i >= 0; i-- {
		r := s.reports[i]
		if serverID != "" && r.ServerID != serverID {
			continue
		}
		if severity != "" && !strings.EqualFold(r.Severity, severity) {
			continue
		}
		if status != "" && string(r.Status) != status {
			continue
		}
		out = append(out, r)
	}
	return out
}

func (s *SecurityReportStore) Get(id string) (*SecurityReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.reports {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, ErrSecurityReportNotFound
}

func (s *SecurityReportStore) Append(r *SecurityReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now().UTC()
	}
	if r.Status == "" {
		r.Status = ReportOpen
	}
	s.reports = append(s.reports, r)
	s.trimLocked()
	return s.save()
}

func (s *SecurityReportStore) trimLocked() {
	if len(s.reports) <= maxSecurityReports {
		return
	}
	s.reports = s.reports[len(s.reports)-maxSecurityReports:]
}

func (s *SecurityReportStore) Update(id string, status *SecurityReportStatus, notes *string) (*SecurityReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range s.reports {
		if r.ID != id {
			continue
		}
		if status != nil {
			r.Status = *status
		}
		if notes != nil {
			r.Notes = *notes
		}
		if err := s.save(); err != nil {
			return nil, err
		}
		return r, nil
	}
	return nil, ErrSecurityReportNotFound
}
