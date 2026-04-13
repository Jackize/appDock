package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const defaultGeminiModel = "gemini-2.0-flash"

// GeminiSecurityService calls Google Generative Language API for threat analysis.
type GeminiSecurityService struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGeminiSecurityService() *GeminiSecurityService {
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		key = os.Getenv("GOOGLE_AI_API_KEY")
	}
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = defaultGeminiModel
	}
	return &GeminiSecurityService{
		apiKey: key,
		model:  model,
		client: &http.Client{Timeout: 90 * time.Second},
	}
}

func (g *GeminiSecurityService) Enabled() bool {
	return g.apiKey != ""
}

// AIThreatJSON is the structured response we ask the model to return.
type AIThreatJSON struct {
	Severity           string   `json:"severity"`
	AttackHypothesis   string   `json:"attack_hypothesis"`
	Confidence         float64  `json:"confidence"`
	Summary            string   `json:"summary"`
	Evidence           string   `json:"evidence"`
	RecommendedActions []string `json:"recommended_actions"`
	Title              string   `json:"title"`
}

func (g *GeminiSecurityService) AnalyzeNetwork(serverLabel, deltaSummary string, snapshotJSON []byte) (*AIThreatJSON, string, error) {
	if !g.Enabled() {
		return nil, "", fmt.Errorf("gemini API key not configured")
	}
	prompt := fmt.Sprintf(`You are a security analyst. Given host network metrics (TCP states, top remote peers, interface counters) and a delta vs the previous sample, assess whether patterns suggest possible DDoS-like traffic, brute-force style probing, or benign activity (e.g. many legitimate clients).

Respond with ONLY valid JSON (no markdown) matching this schema:
{"severity":"info|low|medium|high|critical","attack_hypothesis":"none|possible_ddos|possible_bruteforce|mixed|unknown","confidence":0.0-1.0,"summary":"string","evidence":"string","recommended_actions":["string"],"title":"short title"}

Host: %s

Delta / comparison notes:
%s

Current snapshot JSON:
%s
`, serverLabel, deltaSummary, string(snapshotJSON))

	raw, err := g.generateJSON(prompt)
	if err != nil {
		return nil, "", err
	}
	var out AIThreatJSON
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil, raw, fmt.Errorf("parse AI JSON: %w", err)
	}
	normalizeAIThreat(&out)
	return &out, raw, nil
}

func (g *GeminiSecurityService) Chat(reportContext string, messages []ChatMessage) (string, error) {
	if !g.Enabled() {
		return "", fmt.Errorf("gemini API key not configured")
	}
	var b strings.Builder
	b.WriteString("You are a helpful security assistant for a Docker/host admin. Answer concisely. If a security report is attached, use it as primary context.\n\n")
	if reportContext != "" {
		b.WriteString("--- Attached report context ---\n")
		b.WriteString(reportContext)
		b.WriteString("\n--- End report ---\n\n")
	}
	for _, m := range messages {
		role := m.Role
		if role == "" {
			role = "user"
		}
		b.WriteString(role)
		b.WriteString(": ")
		b.WriteString(m.Content)
		b.WriteString("\n")
	}
	raw, err := g.generateText(b.String())
	if err != nil {
		return "", err
	}
	return raw, nil
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (g *GeminiSecurityService) generateJSON(prompt string) (string, error) {
	return g.generate(prompt, true)
}

func (g *GeminiSecurityService) generateText(prompt string) (string, error) {
	return g.generate(prompt, false)
}

func (g *GeminiSecurityService) generate(prompt string, jsonMode bool) (string, error) {
	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		g.model,
		url.QueryEscape(g.apiKey),
	)
	body := map[string]interface{}{
		"contents": []interface{}{
			map[string]interface{}{
				"parts": []interface{}{
					map[string]string{"text": prompt},
				},
			},
		},
	}
	if jsonMode {
		body["generationConfig"] = map[string]interface{}{
			"responseMimeType": "application/json",
		}
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("gemini API %s: %s", resp.Status, truncateForErr(string(respBody), 500))
	}

	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty gemini response")
	}
	return strings.TrimSpace(parsed.Candidates[0].Content.Parts[0].Text), nil
}

func truncateForErr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func normalizeAIThreat(a *AIThreatJSON) {
	a.Severity = strings.ToLower(strings.TrimSpace(a.Severity))
	if a.Severity == "" {
		a.Severity = "info"
	}
	a.AttackHypothesis = strings.ToLower(strings.TrimSpace(a.AttackHypothesis))
	if a.Title == "" {
		a.Title = "Network security assessment"
	}
}

func severityAtLeast(actual, minimum string) bool {
	return severityRank(actual) >= severityRank(minimum)
}

func severityRank(s string) int {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "critical":
		return 5
	case "high":
		return 4
	case "medium":
		return 3
	case "low":
		return 2
	case "info":
		return 1
	default:
		return 0
	}
}
