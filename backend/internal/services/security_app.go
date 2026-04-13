package services

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// SecurityApp ties network snapshots, heuristics, Gemini, and report persistence.
type SecurityApp struct {
	sm       *ServerManager
	reports  *SecurityReportStore
	gemini   *GeminiSecurityService
	mu       sync.Mutex
	prev     map[string]*prevSnap
	lastAICall map[string]time.Time
}

type prevSnap struct {
	snap *NetworkSnapshot
	at   time.Time
}

func NewSecurityApp(sm *ServerManager, reports *SecurityReportStore, gemini *GeminiSecurityService) *SecurityApp {
	return &SecurityApp{
		sm:         sm,
		reports:    reports,
		gemini:     gemini,
		prev:       make(map[string]*prevSnap),
		lastAICall: make(map[string]time.Time),
	}
}

func (a *SecurityApp) RunBackgroundScanForAllServers() {
	ids := a.sm.ListServerIDs()
	for _, id := range ids {
		_ = a.runBackgroundScan(id)
	}
}

func (a *SecurityApp) runBackgroundScan(serverID string) error {
	minSev := getenvSeverity("APPDOCK_SECURITY_REPORT_MIN_SEVERITY", "medium")
	aiEnabled := getenvBool("APPDOCK_SECURITY_AI_ENABLED", true)
	cooldown := time.Duration(getenvInt("APPDOCK_SECURITY_AI_COOLDOWN_SEC", 600)) * time.Second

	snap, err := a.sm.GetNetworkSnapshot(serverID)
	if err != nil {
		return err
	}

	a.mu.Lock()
	prev := a.prev[serverID]
	delta := describeDelta(prev, snap)
	heurTrigger, heurNotes, heurSev := heuristicThreat(prev, snap)
	a.prev[serverID] = &prevSnap{snap: snap, at: time.Now()}
	a.mu.Unlock()

	if !heurTrigger {
		return nil
	}

	snapJSON, _ := json.Marshal(snap)
	label := fmt.Sprintf("%s (%s)", a.sm.ServerDisplayName(serverID), serverID)

	var ai *AIThreatJSON
	var aiRaw string
	callAI := aiEnabled && a.gemini.Enabled() && (cooldown <= 0 || time.Since(a.lastAICall[serverID]) >= cooldown)

	if callAI {
		var gerr error
		ai, aiRaw, gerr = a.gemini.AnalyzeNetwork(label, delta, snapJSON)
		if gerr == nil {
			a.mu.Lock()
			a.lastAICall[serverID] = time.Now()
			a.mu.Unlock()
		}
	}

	finalSev := heurSev
	source := "heuristic"
	if ai != nil {
		finalSev = maxSeverity(heurSev, ai.Severity)
		source = "gemini"
	}

	if !severityAtLeast(finalSev, minSev) {
		return nil
	}

	rep := buildReport(serverID, snap, delta, heurNotes, heurSev, ai, aiRaw, source, finalSev)
	return a.reports.Append(rep)
}

// RunManualAnalysis always writes a report (admin-triggered).
func (a *SecurityApp) RunManualAnalysis(serverID string, forceAI bool) (*SecurityReport, error) {
	snap, err := a.sm.GetNetworkSnapshot(serverID)
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	prev := a.prev[serverID]
	delta := describeDelta(prev, snap)
	_, heurNotes, heurSev := heuristicThreat(prev, snap)
	a.prev[serverID] = &prevSnap{snap: snap, at: time.Now()}
	a.mu.Unlock()

	snapJSON, _ := json.Marshal(snap)
	label := fmt.Sprintf("%s (%s)", a.sm.ServerDisplayName(serverID), serverID)

	aiEnabled := getenvBool("APPDOCK_SECURITY_AI_ENABLED", true)
	var ai *AIThreatJSON
	var aiRaw string
	if aiEnabled && a.gemini.Enabled() {
		var gerr error
		ai, aiRaw, gerr = a.gemini.AnalyzeNetwork(label, delta, snapJSON)
		if gerr != nil && ai == nil {
			aiRaw = gerr.Error()
		}
	}

	finalSev := heurSev
	source := "heuristic"
	if ai != nil {
		finalSev = maxSeverity(heurSev, ai.Severity)
		source = "gemini"
	}

	rep := buildReport(serverID, snap, delta, heurNotes, heurSev, ai, aiRaw, source, finalSev)
	if err := a.reports.Append(rep); err != nil {
		return nil, err
	}
	return rep, nil
}

func buildReport(serverID string, snap *NetworkSnapshot, delta, heurNotes, heurSev string, ai *AIThreatJSON, aiRaw, source, finalSev string) *SecurityReport {
	snapJSON, _ := json.Marshal(snap)
	r := &SecurityReport{
		ServerID:           serverID,
		Severity:           finalSev,
		Source:             source,
		MetricsSnapshot:    snapJSON,
		DeltaSummary:       delta,
		HeuristicNotes:     heurNotes,
		Status:             ReportOpen,
		AIResponseRaw:      aiRaw,
		RecommendedActions: nil,
	}
	if ai != nil {
		r.Title = ai.Title
		r.AISummary = ai.Summary
		r.AIEvidence = ai.Evidence
		r.AIAttackHypothesis = ai.AttackHypothesis
		r.AIConfidence = ai.Confidence
		r.RecommendedActions = ai.RecommendedActions
		if r.Title == "" {
			r.Title = "Network security assessment"
		}
	} else {
		r.Title = fmt.Sprintf("Heuristic network review (%s)", heurSev)
		r.AISummary = "AI analysis was not available; see heuristic notes and metrics."
	}
	if r.Title == "" {
		r.Title = "Network security assessment"
	}
	return r
}

func maxSeverity(a, b string) string {
	if severityRank(a) >= severityRank(b) {
		return a
	}
	return b
}

func heuristicThreat(prev *prevSnap, curr *NetworkSnapshot) (trigger bool, notes string, est string) {
	est = "info"
	var parts []string
	bump := func(s string) {
		if severityRank(s) > severityRank(est) {
			est = s
		}
	}

	syn := curr.TCPByStatus["SYN_RECV"]
	tw := curr.TCPByStatus["TIME_WAIT"]
	established := curr.TCPByStatus["ESTABLISHED"]

	if curr.UniqueRemoteIPs > 2500 {
		trigger = true
		parts = append(parts, fmt.Sprintf("very high distinct remote IP count: %d", curr.UniqueRemoteIPs))
		bump("high")
	} else if curr.UniqueRemoteIPs > 900 {
		trigger = true
		parts = append(parts, fmt.Sprintf("elevated distinct remote IPs: %d", curr.UniqueRemoteIPs))
		bump("medium")
	}

	if syn > 500 {
		trigger = true
		parts = append(parts, fmt.Sprintf("large SYN_RECV count: %d", syn))
		bump("high")
	} else if syn > 120 {
		trigger = true
		parts = append(parts, fmt.Sprintf("elevated SYN_RECV: %d", syn))
		bump("medium")
	}

	if tw > 8000 {
		trigger = true
		parts = append(parts, fmt.Sprintf("very high TIME_WAIT: %d", tw))
		bump("medium")
	}

	if established > 20000 {
		trigger = true
		parts = append(parts, fmt.Sprintf("very high ESTABLISHED: %d", established))
		bump("high")
	} else if established > 8000 {
		trigger = true
		parts = append(parts, fmt.Sprintf("high ESTABLISHED: %d", established))
		bump("medium")
	}

	if curr.TCPCount > 25000 {
		trigger = true
		parts = append(parts, fmt.Sprintf("total TCP socket rows: %d", curr.TCPCount))
		bump("medium")
	}

	if prev != nil {
		dIP := curr.UniqueRemoteIPs - prev.snap.UniqueRemoteIPs
		if dIP > 500 {
			trigger = true
			parts = append(parts, fmt.Sprintf("sharp increase in distinct remote IPs vs previous sample: +%d", dIP))
			bump("medium")
		}
	}

	return trigger, strings.Join(parts, "; "), est
}

func describeDelta(prev *prevSnap, curr *NetworkSnapshot) string {
	if prev == nil {
		return "No previous sample in this process — first observation for delta comparison."
	}
	dt := time.Since(prev.at)
	s := prev.snap
	var b strings.Builder
	fmt.Fprintf(&b, "Elapsed since previous sample: %s\n", dt.Round(time.Second))
	fmt.Fprintf(&b, "TCP rows: %d -> %d; distinct remote IPs: %d -> %d\n", s.TCPCount, curr.TCPCount, s.UniqueRemoteIPs, curr.UniqueRemoteIPs)
	fmt.Fprintf(&b, "SYN_RECV: %d -> %d; TIME_WAIT: %d -> %d; ESTABLISHED: %d -> %d\n",
		s.TCPByStatus["SYN_RECV"], curr.TCPByStatus["SYN_RECV"],
		s.TCPByStatus["TIME_WAIT"], curr.TCPByStatus["TIME_WAIT"],
		s.TCPByStatus["ESTABLISHED"], curr.TCPByStatus["ESTABLISHED"])
	return b.String()
}

func getenvBool(key string, def bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return def
	}
	return v == "1" || v == "true" || v == "yes"
}

func getenvInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func getenvSeverity(key, def string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	return v
}

// ChatWithReport runs a short assistant turn; reportBody is optional trimmed JSON/text.
func (a *SecurityApp) ChatWithReport(reportBody string, messages []ChatMessage) (string, error) {
	if !a.gemini.Enabled() {
		return "", fmt.Errorf("GEMINI_API_KEY not configured")
	}
	return a.gemini.Chat(reportBody, messages)
}

func (a *SecurityApp) ListReports(serverID, severity, status string) []*SecurityReport {
	return a.reports.List(serverID, severity, status)
}

func (a *SecurityApp) GetReport(id string) (*SecurityReport, error) {
	return a.reports.Get(id)
}

func (a *SecurityApp) PatchReport(id string, status *SecurityReportStatus, notes *string) (*SecurityReport, error) {
	return a.reports.Update(id, status, notes)
}
