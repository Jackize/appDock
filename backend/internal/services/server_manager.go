package services

import (
	"encoding/json"
	"sync"
	"time"

	"appdock/internal/models"
)

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
	for _, server := range store.List() {
		if !server.IsLocal {
			sm.agentClients[server.ID] = NewAgentClient(server.Host, server.APIKey)
		}
	}

	// Start health check
	go sm.healthCheckLoop()

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
	servers := m.store.List()
	for _, server := range servers {
		var status models.ServerStatus

		if server.IsLocal {
			if m.localDocker.IsConnected() {
				status = models.ServerStatusOnline
			} else {
				status = models.ServerStatusOffline
			}
		} else {
			client := m.getAgentClient(server.ID)
			if client != nil {
				if err := client.Health(); err == nil {
					status = models.ServerStatusOnline
				} else {
					status = models.ServerStatusOffline
				}
			} else {
				status = models.ServerStatusOffline
			}
		}

		m.store.UpdateStatus(server.ID, status)
	}
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

	// Get Docker stats from agent
	var containersRunning, containersStopped, imagesCount, volumesCount, networksCount int

	if containersData, err := client.ListContainers(true); err == nil {
		var containers []json.RawMessage
		if json.Unmarshal(containersData, &containers) == nil {
			for _, c := range containers {
				var ctr struct {
					State string `json:"state"`
				}
				if json.Unmarshal(c, &ctr) == nil {
					if ctr.State == "running" {
						containersRunning++
					} else {
						containersStopped++
					}
				}
			}
		}
	}

	if imagesData, err := client.ListImages(); err == nil {
		var images []json.RawMessage
		if json.Unmarshal(imagesData, &images) == nil {
			imagesCount = len(images)
		}
	}

	if volumesData, err := client.ListVolumes(); err == nil {
		var volumes []json.RawMessage
		if json.Unmarshal(volumesData, &volumes) == nil {
			volumesCount = len(volumes)
		}
	}

	if networksData, err := client.ListNetworks(); err == nil {
		var networks []json.RawMessage
		if json.Unmarshal(networksData, &networks) == nil {
			networksCount = len(networks)
		}
	}

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
		ContainersRunning: containersRunning,
		ContainersStopped: containersStopped,
		ImagesCount:       imagesCount,
		VolumesCount:      volumesCount,
		NetworksCount:     networksCount,
	}, nil
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
