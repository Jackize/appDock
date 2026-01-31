package services

import (
	"context"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
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
	ContainersRunning int     `json:"containersRunning"`
	ContainersStopped int     `json:"containersStopped"`
	ImagesCount       int     `json:"imagesCount"`
	VolumesCount      int     `json:"volumesCount"`
	NetworksCount     int     `json:"networksCount"`
	CPUUsage          float64 `json:"cpuUsage"`
	MemoryUsage       float64 `json:"memoryUsage"`
	MemoryTotal       int64   `json:"memoryTotal"`
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

	return &SystemStats{
		ContainersRunning: info.ContainersRunning,
		ContainersStopped: info.ContainersStopped,
		ImagesCount:       info.Images,
		VolumesCount:      volumesCount,
		NetworksCount:     networksCount,
		MemoryTotal:       info.MemTotal,
	}, nil
}
