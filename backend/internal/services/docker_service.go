package services

import (
	"context"
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

type DockerService struct {
	client *client.Client
	ctx    context.Context
}

// NewDockerService tạo một Docker service mới
func NewDockerService() (*DockerService, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	return &DockerService{
		client: cli,
		ctx:    context.Background(),
	}, nil
}

// Close đóng kết nối Docker client
func (d *DockerService) Close() error {
	return d.client.Close()
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
	info, err := d.client.Info(d.ctx)
	if err != nil {
		return nil, err
	}

	// Đếm volumes
	volumes, err := d.client.VolumeList(d.ctx, volume.ListOptions{})
	volumesCount := 0
	if err == nil {
		volumesCount = len(volumes.Volumes)
	}

	// Đếm networks
	networks, err := d.client.NetworkList(d.ctx, network.ListOptions{
		Filters: filters.NewArgs(filters.Arg("type", "custom")),
	})
	networksCount := len(networks)
	if err != nil {
		networksCount = 0
	}

	// Machine-level CPU usage (100ms sample interval)
	cpuPercents, err := cpu.Percent(100*time.Millisecond, false)
	cpuUsage := 0.0
	if err == nil && len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}

	// Machine-level memory usage
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

	// CPU temperature (requires lm-sensors on Linux)
	var cpuTemp *float64
	temps, err := sensors.SensorsTemperatures()
	if err == nil && len(temps) > 0 {
		for _, t := range temps {
			// Look for CPU-related sensors (coretemp, k10temp, etc.)
			if t.SensorKey == "coretemp_packageid0_input" ||
				t.SensorKey == "k10temp_tctl_input" ||
				t.SensorKey == "cpu_thermal_input" ||
				t.SensorKey == "acpitz_input" {
				cpuTemp = &t.Temperature
				break
			}
		}
		// Fallback: use first sensor with "core" or "cpu" in name
		if cpuTemp == nil {
			for _, t := range temps {
				if t.Temperature > 0 {
					cpuTemp = &t.Temperature
					break
				}
			}
		}
	}

	// Disk usage (root partition)
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
		ContainersRunning: info.ContainersRunning,
		ContainersStopped: info.ContainersStopped,
		ImagesCount:       info.Images,
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
