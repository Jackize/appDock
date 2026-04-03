package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AgentClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewAgentClient(host, apiKey string) *AgentClient {
	return &AgentClient{
		baseURL: host,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *AgentClient) doRequest(method, path string, body interface{}) ([]byte, error) {
	url := c.baseURL + path

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("%s", errResp.Error)
		}
		return nil, fmt.Errorf("agent returned status %d", resp.StatusCode)
	}

	return respBody, nil
}

// ==================== Health ====================

func (c *AgentClient) Health() error {
	_, err := c.doRequest("GET", "/health", nil)
	return err
}

// ==================== System ====================

type AgentSystemStats struct {
	CPUUsage       float64  `json:"cpuUsage"`
	CPUCores       int      `json:"cpuCores"`
	CPUTemperature *float64 `json:"cpuTemperature,omitempty"`
	MemoryTotal    uint64   `json:"memoryTotal"`
	MemoryUsed     uint64   `json:"memoryUsed"`
	MemoryFree     uint64   `json:"memoryFree"`
	MemoryCached   uint64   `json:"memoryCached"`
	MemoryUsage    float64  `json:"memoryUsage"`
	DiskTotal      uint64   `json:"diskTotal"`
	DiskUsed       uint64   `json:"diskUsed"`
	DiskFree       uint64   `json:"diskFree"`
	DiskUsage      float64  `json:"diskUsage"`
}

type AgentSystemInfo struct {
	Hostname     string `json:"hostname"`
	OS           string `json:"os"`
	Platform     string `json:"platform"`
	Architecture string `json:"architecture"`
	CPUModel     string `json:"cpuModel"`
	CPUCores     int    `json:"cpuCores"`
	Uptime       uint64 `json:"uptime"`
	BootTime     uint64 `json:"bootTime"`
}

func (c *AgentClient) GetSystemStats() (*AgentSystemStats, error) {
	data, err := c.doRequest("GET", "/api/system/stats", nil)
	if err != nil {
		return nil, err
	}

	var stats AgentSystemStats
	if err := json.Unmarshal(data, &stats); err != nil {
		return nil, err
	}

	return &stats, nil
}

func (c *AgentClient) GetSystemInfo() (*AgentSystemInfo, error) {
	data, err := c.doRequest("GET", "/api/system/info", nil)
	if err != nil {
		return nil, err
	}

	var info AgentSystemInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, err
	}

	return &info, nil
}

// ==================== Docker ====================

func (c *AgentClient) GetDockerInfo() (json.RawMessage, error) {
	data, err := c.doRequest("GET", "/api/docker/info", nil)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (c *AgentClient) GetDockerVersion() (json.RawMessage, error) {
	data, err := c.doRequest("GET", "/api/docker/version", nil)
	if err != nil {
		return nil, err
	}
	return data, nil
}

// Containers

func (c *AgentClient) ListContainers(all bool) (json.RawMessage, error) {
	path := "/api/docker/containers"
	if all {
		path += "?all=true"
	}
	return c.doRequest("GET", path, nil)
}

func (c *AgentClient) GetContainer(id string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/containers/"+id, nil)
}

func (c *AgentClient) StartContainer(id string) error {
	_, err := c.doRequest("POST", "/api/docker/containers/"+id+"/start", nil)
	return err
}

func (c *AgentClient) StopContainer(id string) error {
	_, err := c.doRequest("POST", "/api/docker/containers/"+id+"/stop", nil)
	return err
}

func (c *AgentClient) RestartContainer(id string) error {
	_, err := c.doRequest("POST", "/api/docker/containers/"+id+"/restart", nil)
	return err
}

func (c *AgentClient) RemoveContainer(id string, force bool) error {
	path := "/api/docker/containers/" + id
	if force {
		path += "?force=true"
	}
	_, err := c.doRequest("DELETE", path, nil)
	return err
}

func (c *AgentClient) GetContainerLogs(id string, tail string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/containers/"+id+"/logs?tail="+tail, nil)
}

func (c *AgentClient) GetContainerStats(id string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/containers/"+id+"/stats", nil)
}

// Images

func (c *AgentClient) ListImages() (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/images", nil)
}

func (c *AgentClient) GetImage(id string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/images/"+id, nil)
}

func (c *AgentClient) RemoveImage(id string, force bool) error {
	path := "/api/docker/images/" + id
	if force {
		path += "?force=true"
	}
	_, err := c.doRequest("DELETE", path, nil)
	return err
}

// Networks

func (c *AgentClient) ListNetworks() (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/networks", nil)
}

func (c *AgentClient) GetNetwork(id string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/networks/"+id, nil)
}

func (c *AgentClient) CreateNetwork(body interface{}) (json.RawMessage, error) {
	return c.doRequest("POST", "/api/docker/networks", body)
}

func (c *AgentClient) RemoveNetwork(id string) error {
	_, err := c.doRequest("DELETE", "/api/docker/networks/"+id, nil)
	return err
}

// Volumes

func (c *AgentClient) ListVolumes() (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/volumes", nil)
}

func (c *AgentClient) GetVolume(name string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/docker/volumes/"+name, nil)
}

func (c *AgentClient) CreateVolume(body interface{}) (json.RawMessage, error) {
	return c.doRequest("POST", "/api/docker/volumes", body)
}

func (c *AgentClient) RemoveVolume(name string, force bool) error {
	path := "/api/docker/volumes/" + name
	if force {
		path += "?force=true"
	}
	_, err := c.doRequest("DELETE", path, nil)
	return err
}

// ==================== Nginx ====================

func (c *AgentClient) GetNginxStatus() (json.RawMessage, error) {
	return c.doRequest("GET", "/api/nginx/status", nil)
}

func (c *AgentClient) InstallNginx() error {
	_, err := c.doRequestWithTimeout("POST", "/api/nginx/install", nil, 5*time.Minute)
	return err
}

func (c *AgentClient) InstallCertbot() error {
	_, err := c.doRequestWithTimeout("POST", "/api/nginx/install-certbot", nil, 5*time.Minute)
	return err
}

func (c *AgentClient) StartNginx() error {
	_, err := c.doRequest("POST", "/api/nginx/start", nil)
	return err
}

func (c *AgentClient) StopNginx() error {
	_, err := c.doRequest("POST", "/api/nginx/stop", nil)
	return err
}

func (c *AgentClient) ReloadNginx() error {
	_, err := c.doRequest("POST", "/api/nginx/reload", nil)
	return err
}

func (c *AgentClient) TestNginxConfig() (json.RawMessage, error) {
	return c.doRequest("POST", "/api/nginx/test", nil)
}

func (c *AgentClient) ListNginxDomains() (json.RawMessage, error) {
	return c.doRequest("GET", "/api/nginx/domains", nil)
}

func (c *AgentClient) GetNginxDomain(id string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/nginx/domains/"+id, nil)
}

func (c *AgentClient) CreateNginxDomain(body interface{}) (json.RawMessage, error) {
	return c.doRequest("POST", "/api/nginx/domains", body)
}

func (c *AgentClient) UpdateNginxDomain(id string, body interface{}) (json.RawMessage, error) {
	return c.doRequest("PUT", "/api/nginx/domains/"+id, body)
}

func (c *AgentClient) DeleteNginxDomain(id string) error {
	_, err := c.doRequest("DELETE", "/api/nginx/domains/"+id, nil)
	return err
}

func (c *AgentClient) EnableNginxDomain(id string) error {
	_, err := c.doRequest("POST", "/api/nginx/domains/"+id+"/enable", nil)
	return err
}

func (c *AgentClient) DisableNginxDomain(id string) error {
	_, err := c.doRequest("POST", "/api/nginx/domains/"+id+"/disable", nil)
	return err
}

func (c *AgentClient) GetNginxDomainConfig(id string) (json.RawMessage, error) {
	return c.doRequest("GET", "/api/nginx/domains/"+id+"/config", nil)
}

func (c *AgentClient) ListNginxCertificates() (json.RawMessage, error) {
	return c.doRequest("GET", "/api/nginx/certificates", nil)
}

func (c *AgentClient) RequestNginxCertificate(body interface{}) error {
	_, err := c.doRequestWithTimeout("POST", "/api/nginx/certificates", body, 5*time.Minute)
	return err
}

func (c *AgentClient) RevokeNginxCertificate(domain string) error {
	_, err := c.doRequest("DELETE", "/api/nginx/certificates/"+domain, nil)
	return err
}

// doRequestWithTimeout is like doRequest but with a custom timeout
func (c *AgentClient) doRequestWithTimeout(method, path string, body interface{}, timeout time.Duration) ([]byte, error) {
	oldTimeout := c.httpClient.Timeout
	c.httpClient.Timeout = timeout
	defer func() { c.httpClient.Timeout = oldTimeout }()
	return c.doRequest(method, path, body)
}
