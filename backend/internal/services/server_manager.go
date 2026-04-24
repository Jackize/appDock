package services

import (
	"encoding/json"
	"sync"
	"time"

	"appdock/internal/models"
)

const maxConcurrentHealthChecks = 16

type ServerManager struct {
	store        *ServerStore
	localDocker  *DockerService
	agentClients map[string]*AgentClient
	mu           sync.RWMutex
}

func NewServerManager(store *ServerStore, localDocker *DockerService) *ServerManager {
	sm := &ServerManager{
		store:        store,
		localDocker:  localDocker,
		agentClients: make(map[string]*AgentClient),
	}

	// Initialize agent clients for existing servers
	if store != nil {
		for _, server := range store.List() {
			if !server.IsLocal {
				sm.agentClients[server.ID] = NewAgentClient(server.Host, server.APIKey)
			}
		}

		// Start health check
		go sm.healthCheckLoop()
	}

	return sm
}

func (m *ServerManager) healthCheckLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Check immediately
	m.checkAllServers()

	for range ticker.C {
		m.checkAllServers()
	}
}

func (m *ServerManager) checkAllServers() {
	if m.store == nil {
		return
	}

	servers := m.store.List()
	var wg sync.WaitGroup
	var statusesMu sync.Mutex
	statuses := make(map[string]models.ServerStatus, len(servers))
	sem := make(chan struct{}, maxConcurrentHealthChecks)

	for _, server := range servers {
		server := server
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			status := m.checkServerStatus(server)
			statusesMu.Lock()
			statuses[server.ID] = status
			statusesMu.Unlock()
		}()
	}

	wg.Wait()
	m.store.UpdateStatuses(statuses)
}

func (m *ServerManager) checkServerStatus(server *models.Server) models.ServerStatus {
	if server.IsLocal {
		if m.localDocker != nil && m.localDocker.IsConnected() {
			return models.ServerStatusOnline
		}
		return models.ServerStatusOffline
	}

	client := m.getAgentClient(server.ID)
	if client == nil {
		return models.ServerStatusOffline
	}
	if err := client.Health(); err == nil {
		return models.ServerStatusOnline
	}
	return models.ServerStatusOffline
}

func (m *ServerManager) getAgentClient(serverID string) *AgentClient {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.agentClients[serverID]
}

func (m *ServerManager) AddAgentClient(server *models.Server) {
	if server.IsLocal {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.agentClients[server.ID] = NewAgentClient(server.Host, server.APIKey)
}

func (m *ServerManager) UpdateAgentClient(server *models.Server) {
	if server.IsLocal {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.agentClients[server.ID] = NewAgentClient(server.Host, server.APIKey)
}

func (m *ServerManager) RemoveAgentClient(serverID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.agentClients, serverID)
}

func (m *ServerManager) IsLocal(serverID string) bool {
	return serverID == "" || serverID == "local"
}

// ListServerIDs returns all configured server IDs (including local).
func (m *ServerManager) ListServerIDs() []string {
	if m.store == nil {
		return []string{"local"}
	}
	list := m.store.List()
	out := make([]string, 0, len(list))
	for _, s := range list {
		out = append(out, s.ID)
	}
	return out
}

// ServerDisplayName returns a human-readable name for UI / AI prompts.
func (m *ServerManager) ServerDisplayName(serverID string) string {
	if m.store == nil {
		return serverID
	}
	s, err := m.store.Get(serverID)
	if err != nil {
		return serverID
	}
	return s.Name
}

func (m *ServerManager) GetLocalDocker() *DockerService {
	return m.localDocker
}

// ==================== System Stats ====================

type CombinedSystemStats struct {
	// System stats
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

	// Docker stats
	ContainersRunning int `json:"containersRunning"`
	ContainersStopped int `json:"containersStopped"`
	ImagesCount       int `json:"imagesCount"`
	VolumesCount      int `json:"volumesCount"`
	NetworksCount     int `json:"networksCount"`
}

type dockerCounts struct {
	containersRunning int
	containersStopped int
	imagesCount       int
	volumesCount      int
	networksCount     int
}

func (m *ServerManager) GetSystemStats(serverID string) (*CombinedSystemStats, error) {
	if m.IsLocal(serverID) {
		// Get local stats
		dockerStats, err := m.localDocker.GetSystemStats()
		if err != nil {
			return nil, err
		}

		return &CombinedSystemStats{
			CPUUsage:          dockerStats.CPUUsage,
			CPUCores:          0, // Not available from DockerService
			CPUTemperature:    dockerStats.CPUTemperature,
			MemoryTotal:       dockerStats.MemoryTotal,
			MemoryUsed:        dockerStats.MemoryUsed,
			MemoryFree:        dockerStats.MemoryFree,
			MemoryCached:      dockerStats.MemoryCached,
			MemoryUsage:       dockerStats.MemoryUsage,
			DiskTotal:         dockerStats.DiskTotal,
			DiskUsed:          dockerStats.DiskUsed,
			DiskFree:          0,
			DiskUsage:         dockerStats.DiskUsage,
			ContainersRunning: dockerStats.ContainersRunning,
			ContainersStopped: dockerStats.ContainersStopped,
			ImagesCount:       dockerStats.ImagesCount,
			VolumesCount:      dockerStats.VolumesCount,
			NetworksCount:     dockerStats.NetworksCount,
		}, nil
	}

	// Get remote stats
	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	systemStats, err := client.GetSystemStats()
	if err != nil {
		return nil, err
	}

	counts := m.getRemoteDockerCounts(client)

	return &CombinedSystemStats{
		CPUUsage:          systemStats.CPUUsage,
		CPUCores:          systemStats.CPUCores,
		CPUTemperature:    systemStats.CPUTemperature,
		MemoryTotal:       systemStats.MemoryTotal,
		MemoryUsed:        systemStats.MemoryUsed,
		MemoryFree:        systemStats.MemoryFree,
		MemoryCached:      systemStats.MemoryCached,
		MemoryUsage:       systemStats.MemoryUsage,
		DiskTotal:         systemStats.DiskTotal,
		DiskUsed:          systemStats.DiskUsed,
		DiskFree:          systemStats.DiskFree,
		DiskUsage:         systemStats.DiskUsage,
		ContainersRunning: counts.containersRunning,
		ContainersStopped: counts.containersStopped,
		ImagesCount:       counts.imagesCount,
		VolumesCount:      counts.volumesCount,
		NetworksCount:     counts.networksCount,
	}, nil
}

func (m *ServerManager) getRemoteDockerCounts(client *AgentClient) dockerCounts {
	if summary, err := client.GetDockerSummary(); err == nil {
		return dockerCounts{
			containersRunning: summary.ContainersRunning,
			containersStopped: summary.ContainersStopped,
			imagesCount:       summary.ImagesCount,
			volumesCount:      summary.VolumesCount,
			networksCount:     summary.NetworksCount,
		}
	}

	return m.getRemoteDockerCountsFallback(client)
}

func (m *ServerManager) getRemoteDockerCountsFallback(client *AgentClient) dockerCounts {
	var counts dockerCounts
	var wg sync.WaitGroup

	wg.Add(4)
	go func() {
		defer wg.Done()
		containersData, err := client.ListContainers(true)
		if err != nil {
			return
		}
		var containers []json.RawMessage
		if json.Unmarshal(containersData, &containers) != nil {
			return
		}
		for _, c := range containers {
			var ctr struct {
				State string `json:"state"`
			}
			if json.Unmarshal(c, &ctr) == nil {
				if ctr.State == "running" {
					counts.containersRunning++
				} else {
					counts.containersStopped++
				}
			}
		}
	}()

	go func() {
		defer wg.Done()
		imagesData, err := client.ListImages()
		if err != nil {
			return
		}
		var images []json.RawMessage
		if json.Unmarshal(imagesData, &images) == nil {
			counts.imagesCount = len(images)
		}
	}()

	go func() {
		defer wg.Done()
		volumesData, err := client.ListVolumes()
		if err != nil {
			return
		}
		var volumes []json.RawMessage
		if json.Unmarshal(volumesData, &volumes) == nil {
			counts.volumesCount = len(volumes)
		}
	}()

	go func() {
		defer wg.Done()
		networksData, err := client.ListNetworks()
		if err != nil {
			return
		}
		var networks []json.RawMessage
		if json.Unmarshal(networksData, &networks) == nil {
			counts.networksCount = len(networks)
		}
	}()

	wg.Wait()
	return counts
}

// ==================== Containers ====================

func (m *ServerManager) ListContainers(serverID string, all bool) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.ListContainers(all)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.ListContainers(all)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) GetContainer(serverID, containerID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.GetContainer(containerID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.GetContainer(containerID)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

// InspectContainer returns the raw Docker inspect payload for a container.
func (m *ServerManager) InspectContainer(serverID, containerID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.InspectContainer(containerID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	// Agent already returns raw Docker inspect at GET /api/docker/containers/:id
	data, err := client.GetContainer(containerID)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) StartContainer(serverID, containerID string) error {
	if m.IsLocal(serverID) {
		return m.localDocker.StartContainer(containerID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.StartContainer(containerID)
}

func (m *ServerManager) StopContainer(serverID, containerID string) error {
	if m.IsLocal(serverID) {
		return m.localDocker.StopContainer(containerID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.StopContainer(containerID)
}

func (m *ServerManager) RestartContainer(serverID, containerID string) error {
	if m.IsLocal(serverID) {
		return m.localDocker.RestartContainer(containerID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.RestartContainer(containerID)
}

func (m *ServerManager) RemoveContainer(serverID, containerID string, force bool) error {
	if m.IsLocal(serverID) {
		return m.localDocker.RemoveContainer(containerID, force)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.RemoveContainer(containerID, force)
}

func (m *ServerManager) GetContainerLogs(serverID, containerID, tail string) (string, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.GetContainerLogs(containerID, tail)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return "", ErrServerNotFound
	}

	data, err := client.GetContainerLogs(containerID, tail)
	if err != nil {
		return "", err
	}

	var result struct {
		Logs string `json:"logs"`
	}
	json.Unmarshal(data, &result)
	return result.Logs, nil
}

func (m *ServerManager) GetContainerStats(serverID, containerID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.GetContainerStats(containerID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.GetContainerStats(containerID)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

// ==================== Images ====================

func (m *ServerManager) ListImages(serverID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.ListImages()
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.ListImages()
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) GetImage(serverID, imageID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.GetImage(imageID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.GetImage(imageID)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) RemoveImage(serverID, imageID string, force bool) error {
	if m.IsLocal(serverID) {
		return m.localDocker.RemoveImage(imageID, force)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.RemoveImage(imageID, force)
}

// PullImage pulls an image reference on the given server (local Docker or agent).
func (m *ServerManager) PullImage(serverID, ref, registryAuth string) error {
	if m.IsLocal(serverID) {
		return m.localDocker.PullImageWithAuth(ref, registryAuth)
	}
	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}
	return client.PullImage(ref, registryAuth)
}

// ==================== Networks ====================

func (m *ServerManager) ListNetworks(serverID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.ListNetworks()
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.ListNetworks()
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) GetNetwork(serverID, networkID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.GetNetwork(networkID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.GetNetwork(networkID)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) CreateNetwork(serverID string, req CreateNetworkRequest) (string, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.CreateNetwork(req)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return "", ErrServerNotFound
	}

	data, err := client.CreateNetwork(req)
	if err != nil {
		return "", err
	}

	var result struct {
		ID string `json:"id"`
	}
	json.Unmarshal(data, &result)
	return result.ID, nil
}

func (m *ServerManager) RemoveNetwork(serverID, networkID string) error {
	if m.IsLocal(serverID) {
		return m.localDocker.RemoveNetwork(networkID)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.RemoveNetwork(networkID)
}

// ==================== Volumes ====================

func (m *ServerManager) ListVolumes(serverID string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.ListVolumes()
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.ListVolumes()
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) GetVolume(serverID, volumeName string) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.GetVolume(volumeName)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.GetVolume(volumeName)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) CreateVolume(serverID string, req CreateVolumeRequest) (interface{}, error) {
	if m.IsLocal(serverID) {
		return m.localDocker.CreateVolume(req)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}

	data, err := client.CreateVolume(req)
	if err != nil {
		return nil, err
	}

	var result interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

func (m *ServerManager) RemoveVolume(serverID, volumeName string, force bool) error {
	if m.IsLocal(serverID) {
		return m.localDocker.RemoveVolume(volumeName, force)
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.RemoveVolume(volumeName, force)
}

// ==================== Test Connection ====================

func (m *ServerManager) GetNetworkSnapshot(serverID string) (*NetworkSnapshot, error) {
	if m.IsLocal(serverID) {
		return BuildLocalNetworkSnapshot()
	}
	client := m.getAgentClient(serverID)
	if client == nil {
		return nil, ErrServerNotFound
	}
	return client.GetNetworkSnapshot()
}

func (m *ServerManager) TestConnection(serverID string) error {
	if m.IsLocal(serverID) {
		if m.localDocker.IsConnected() {
			return nil
		}
		return ErrDockerNotConnected
	}

	client := m.getAgentClient(serverID)
	if client == nil {
		return ErrServerNotFound
	}

	return client.Health()
}
