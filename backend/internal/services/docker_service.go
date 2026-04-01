package services

import (
	"context"
	"errors"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/sensors"
)

var ErrDockerNotConnected = errors.New("Docker is not running or not accessible")

type DockerService struct {
	client       *client.Client
	ctx          context.Context
	connected    bool
	mu           sync.RWMutex
	stopHealthCh chan struct{}
	listeners    []func(connected bool)
}

// NewDockerService creates a new Docker service (gracefully handles Docker not running)
func NewDockerService() (*DockerService, error) {
	ds := &DockerService{
		ctx:          context.Background(),
		connected:    false,
		stopHealthCh: make(chan struct{}),
		listeners:    make([]func(connected bool), 0),
	}

	ds.tryConnect()
	return ds, nil
}

// tryConnect attempts to connect to Docker daemon
func (d *DockerService) tryConnect() bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	// If already connected, just ping to verify
	if d.client != nil {
		_, err := d.client.Ping(d.ctx)
		if err == nil {
			if !d.connected {
				d.connected = true
				d.notifyListeners(true)
			}
			return true
		}
		// Connection lost
		d.client.Close()
		d.client = nil
		if d.connected {
			d.connected = false
			d.notifyListeners(false)
		}
	}

	// Try to create new client
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return false
	}

	// Test connection
	_, err = cli.Ping(d.ctx)
	if err != nil {
		cli.Close()
		return false
	}

	d.client = cli
	wasConnected := d.connected
	d.connected = true
	if !wasConnected {
		d.notifyListeners(true)
	}
	return true
}

// StartHealthCheck starts background health monitoring
func (d *DockerService) StartHealthCheck(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				d.tryConnect()
			case <-d.stopHealthCh:
				return
			}
		}
	}()
}

// OnStatusChange registers a callback for Docker status changes
func (d *DockerService) OnStatusChange(callback func(connected bool)) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.listeners = append(d.listeners, callback)
}

// notifyListeners calls all registered callbacks (must be called with lock held)
func (d *DockerService) notifyListeners(connected bool) {
	for _, listener := range d.listeners {
		go listener(connected)
	}
}

// IsConnected returns true if Docker daemon is available
func (d *DockerService) IsConnected() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.connected && d.client != nil
}

// markDisconnected marks Docker as disconnected (thread-safe)
func (d *DockerService) markDisconnected() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.connected {
		d.connected = false
		if d.client != nil {
			d.client.Close()
			d.client = nil
		}
		d.notifyListeners(false)
	}
}

// handleError checks if an error indicates Docker disconnection and updates status
func (d *DockerService) handleError(err error) error {
	if err == nil {
		return nil
	}
	// Check for connection-related errors
	errStr := err.Error()
	if strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "Cannot connect") ||
		strings.Contains(errStr, "dial unix") ||
		strings.Contains(errStr, "context deadline exceeded") ||
		strings.Contains(errStr, "EOF") ||
		strings.Contains(errStr, "broken pipe") {
		d.markDisconnected()
		return ErrDockerNotConnected
	}
	return err
}

// getClient returns the Docker client safely
func (d *DockerService) getClient() *client.Client {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.client
}

// safeExec executes a function with panic recovery, useful for Docker client operations
func (d *DockerService) safeExec(fn func() error) (err error) {
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			err = ErrDockerNotConnected
		}
	}()
	err = fn()
	if err != nil {
		err = d.handleError(err)
	}
	return
}

// Close closes the Docker client connection
func (d *DockerService) Close() error {
	close(d.stopHealthCh)
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.client != nil {
		return d.client.Close()
	}
	return nil
}

// ==================== SYSTEM ====================

type SystemInfo struct {
	DockerVersion   string `json:"dockerVersion"`
	APIVersion      string `json:"apiVersion"`
	OS              string `json:"os"`
	Architecture    string `json:"architecture"`
	Containers      int    `json:"containers"`
	ContainersRun   int    `json:"containersRunning"`
	ContainersPause int    `json:"containersPaused"`
	ContainersStop  int    `json:"containersStopped"`
	Images          int    `json:"images"`
	MemoryTotal     int64  `json:"memoryTotal"`
	CPUs            int    `json:"cpus"`
}

func (d *DockerService) GetSystemInfo() (*SystemInfo, error) {
	if !d.IsConnected() {
		return nil, ErrDockerNotConnected
	}

	info, err := d.client.Info(d.ctx)
	if err != nil {
		return nil, err
	}

	version, err := d.client.ServerVersion(d.ctx)
	if err != nil {
		return nil, err
	}

	return &SystemInfo{
		DockerVersion:   version.Version,
		APIVersion:      version.APIVersion,
		OS:              info.OperatingSystem,
		Architecture:    info.Architecture,
		Containers:      info.Containers,
		ContainersRun:   info.ContainersRunning,
		ContainersPause: info.ContainersPaused,
		ContainersStop:  info.ContainersStopped,
		Images:          info.Images,
		MemoryTotal:     info.MemTotal,
		CPUs:            info.NCPU,
	}, nil
}

// GetBasicSystemInfo returns system info without Docker (for when Docker is not available)
func (d *DockerService) GetBasicSystemInfo() *SystemInfo {
	vmStat, _ := mem.VirtualMemory()
	memTotal := int64(0)
	if vmStat != nil {
		memTotal = int64(vmStat.Total)
	}

	return &SystemInfo{
		DockerVersion:   "N/A",
		APIVersion:      "N/A",
		OS:              runtime.GOOS,
		Architecture:    runtime.GOARCH,
		Containers:      0,
		ContainersRun:   0,
		ContainersPause: 0,
		ContainersStop:  0,
		Images:          0,
		MemoryTotal:     memTotal,
		CPUs:            runtime.NumCPU(),
	}
}

// ==================== SYSTEM STATS ====================

type SystemStats struct {
	ContainersRunning int      `json:"containersRunning"`
	ContainersStopped int      `json:"containersStopped"`
	ImagesCount       int      `json:"imagesCount"`
	VolumesCount      int      `json:"volumesCount"`
	NetworksCount     int      `json:"networksCount"`
	CPUUsage          float64  `json:"cpuUsage"`
	MemoryUsage       float64  `json:"memoryUsage"`
	MemoryTotal       uint64   `json:"memoryTotal"`
	MemoryUsed        uint64   `json:"memoryUsed"`
	MemoryFree        uint64   `json:"memoryFree"`
	MemoryCached      uint64   `json:"memoryCached"`
	CPUTemperature    *float64 `json:"cpuTemperature,omitempty"`
	DiskUsage         float64  `json:"diskUsage"`
	DiskUsed          uint64   `json:"diskUsed"`
	DiskTotal         uint64   `json:"diskTotal"`
}

func (d *DockerService) GetSystemStats() (*SystemStats, error) {
	// Docker stats (optional - gracefully handle Docker not running)
	containersRunning := 0
	containersStopped := 0
	imagesCount := 0
	volumesCount := 0
	networksCount := 0

	if d.client != nil {
		info, err := d.client.Info(d.ctx)
		if err == nil {
			containersRunning = info.ContainersRunning
			containersStopped = info.ContainersStopped
			imagesCount = info.Images
		}

		volumes, err := d.client.VolumeList(d.ctx, volume.ListOptions{})
		if err == nil {
			volumesCount = len(volumes.Volumes)
		}

		networks, err := d.client.NetworkList(d.ctx, network.ListOptions{
			Filters: filters.NewArgs(filters.Arg("type", "custom")),
		})
		if err == nil {
			networksCount = len(networks)
		}
	}

	// System stats (always available, independent of Docker)
	cpuPercents, err := cpu.Percent(100*time.Millisecond, false)
	cpuUsage := 0.0
	if err == nil && len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}

	vmStat, err := mem.VirtualMemory()
	memoryUsage := 0.0
	memoryTotal := uint64(0)
	memoryUsed := uint64(0)
	memoryFree := uint64(0)
	memoryCached := uint64(0)
	if err == nil {
		memoryUsage = vmStat.UsedPercent
		memoryTotal = vmStat.Total
		memoryUsed = vmStat.Used
		memoryFree = vmStat.Free
		memoryCached = vmStat.Cached + vmStat.Buffers
	}

	var cpuTemp *float64
	temps, err := sensors.SensorsTemperatures()
	if err == nil && len(temps) > 0 {
		for _, t := range temps {
			if t.SensorKey == "coretemp_packageid0_input" ||
				t.SensorKey == "k10temp_tctl_input" ||
				t.SensorKey == "cpu_thermal_input" ||
				t.SensorKey == "acpitz_input" {
				cpuTemp = &t.Temperature
				break
			}
		}
		if cpuTemp == nil {
			for _, t := range temps {
				if t.Temperature > 0 {
					cpuTemp = &t.Temperature
					break
				}
			}
		}
	}

	diskUsage := 0.0
	diskUsed := uint64(0)
	diskTotal := uint64(0)
	diskStat, err := disk.Usage("/")
	if err == nil {
		diskUsage = diskStat.UsedPercent
		diskUsed = diskStat.Used
		diskTotal = diskStat.Total
	}

	return &SystemStats{
		ContainersRunning: containersRunning,
		ContainersStopped: containersStopped,
		ImagesCount:       imagesCount,
		VolumesCount:      volumesCount,
		NetworksCount:     networksCount,
		MemoryTotal:       memoryTotal,
		MemoryUsed:        memoryUsed,
		MemoryFree:        memoryFree,
		MemoryCached:      memoryCached,
		CPUUsage:          cpuUsage,
		MemoryUsage:       memoryUsage,
		CPUTemperature:    cpuTemp,
		DiskUsage:         diskUsage,
		DiskUsed:          diskUsed,
		DiskTotal:         diskTotal,
	}, nil
}
