package services

import (
	"encoding/json"
	"io"
	"strconv"

	"github.com/docker/docker/api/types/container"
)

type ContainerInfo struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Status  string            `json:"status"`
	State   string            `json:"state"`
	Created int64             `json:"created"`
	Ports   []PortMapping     `json:"ports"`
	Labels  map[string]string `json:"labels"`
}

type PortMapping struct {
	PrivatePort uint16 `json:"privatePort"`
	PublicPort  uint16 `json:"publicPort"`
	Type        string `json:"type"`
	IP          string `json:"ip"`
}

func (d *DockerService) ListContainers(all bool) (result []ContainerInfo, err error) {
	if !d.IsConnected() {
		return nil, ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			result = nil
			err = ErrDockerNotConnected
		}
	}()
	containers, err := d.client.ContainerList(d.ctx, container.ListOptions{All: all})
	if err != nil {
		return nil, d.handleError(err)
	}

	result = make([]ContainerInfo, 0, len(containers))
	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = c.Names[0][1:] // Bỏ dấu / ở đầu
		}

		ports := make([]PortMapping, 0, len(c.Ports))
		for _, p := range c.Ports {
			ports = append(ports, PortMapping{
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
				IP:          p.IP,
			})
		}

		result = append(result, ContainerInfo{
			ID:      c.ID[:12],
			Name:    name,
			Image:   c.Image,
			Status:  c.Status,
			State:   c.State,
			Created: c.Created,
			Ports:   ports,
			Labels:  c.Labels,
		})
	}

	return result, nil
}

type ContainerDetail struct {
	ContainerInfo
	Config      ContainerConfig      `json:"config"`
	NetworkInfo ContainerNetworkInfo `json:"network"`
	Mounts      []MountInfo          `json:"mounts"`
}

type ContainerConfig struct {
	Hostname   string            `json:"hostname"`
	Env        []string          `json:"env"`
	Cmd        []string          `json:"cmd"`
	WorkingDir string            `json:"workingDir"`
	Labels     map[string]string `json:"labels"`
}

type ContainerNetworkInfo struct {
	Networks map[string]NetworkEndpoint `json:"networks"`
}

type NetworkEndpoint struct {
	NetworkID string `json:"networkId"`
	IPAddress string `json:"ipAddress"`
	Gateway   string `json:"gateway"`
}

type MountInfo struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode"`
	RW          bool   `json:"rw"`
}

func (d *DockerService) GetContainer(id string) (result *ContainerDetail, err error) {
	if !d.IsConnected() {
		return nil, ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			result = nil
			err = ErrDockerNotConnected
		}
	}()
	c, err := d.client.ContainerInspect(d.ctx, id)
	if err != nil {
		return nil, d.handleError(err)
	}

	ports := make([]PortMapping, 0)
	for port, bindings := range c.NetworkSettings.Ports {
		for _, binding := range bindings {
			var publicPort uint16
			if binding.HostPort != "" {
				// Parse port string to uint16
				var p int
				json.Unmarshal([]byte(binding.HostPort), &p)
				publicPort = uint16(p)
			}
			ports = append(ports, PortMapping{
				PrivatePort: uint16(port.Int()),
				PublicPort:  publicPort,
				Type:        port.Proto(),
				IP:          binding.HostIP,
			})
		}
	}

	networks := make(map[string]NetworkEndpoint)
	for name, net := range c.NetworkSettings.Networks {
		networks[name] = NetworkEndpoint{
			NetworkID: net.NetworkID,
			IPAddress: net.IPAddress,
			Gateway:   net.Gateway,
		}
	}

	mounts := make([]MountInfo, 0, len(c.Mounts))
	for _, m := range c.Mounts {
		mounts = append(mounts, MountInfo{
			Type:        string(m.Type),
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
			RW:          m.RW,
		})
	}

	name := c.Name
	if len(name) > 0 && name[0] == '/' {
		name = name[1:]
	}
	created, err := strconv.ParseInt(c.Created, 10, 64)
	if err != nil {
		return nil, err
	}

	return &ContainerDetail{
		ContainerInfo: ContainerInfo{
			ID:      c.ID[:12],
			Name:    name,
			Image:   c.Config.Image,
			Status:  c.State.Status,
			State:   c.State.Status,
			Created: created,
			Ports:   ports,
			Labels:  c.Config.Labels,
		},
		Config: ContainerConfig{
			Hostname:   c.Config.Hostname,
			Env:        c.Config.Env,
			Cmd:        c.Config.Cmd,
			WorkingDir: c.Config.WorkingDir,
			Labels:     c.Config.Labels,
		},
		NetworkInfo: ContainerNetworkInfo{
			Networks: networks,
		},
		Mounts: mounts,
	}, nil
}

func (d *DockerService) StartContainer(id string) (err error) {
	if !d.IsConnected() {
		return ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			err = ErrDockerNotConnected
		}
	}()
	err = d.client.ContainerStart(d.ctx, id, container.StartOptions{})
	return d.handleError(err)
}

func (d *DockerService) StopContainer(id string) (err error) {
	if !d.IsConnected() {
		return ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			err = ErrDockerNotConnected
		}
	}()
	timeout := 10
	err = d.client.ContainerStop(d.ctx, id, container.StopOptions{Timeout: &timeout})
	return d.handleError(err)
}

func (d *DockerService) RestartContainer(id string) (err error) {
	if !d.IsConnected() {
		return ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			err = ErrDockerNotConnected
		}
	}()
	timeout := 10
	err = d.client.ContainerRestart(d.ctx, id, container.StopOptions{Timeout: &timeout})
	return d.handleError(err)
}

func (d *DockerService) RemoveContainer(id string, force bool) (err error) {
	if !d.IsConnected() {
		return ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			err = ErrDockerNotConnected
		}
	}()
	err = d.client.ContainerRemove(d.ctx, id, container.RemoveOptions{Force: force})
	return d.handleError(err)
}

func (d *DockerService) GetContainerLogs(id string, tail string) (result string, err error) {
	if !d.IsConnected() {
		return "", ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			result = ""
			err = ErrDockerNotConnected
		}
	}()
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
		Timestamps: true,
	}

	reader, err := d.client.ContainerLogs(d.ctx, id, options)
	if err != nil {
		return "", d.handleError(err)
	}
	defer reader.Close()

	logs, err := io.ReadAll(reader)
	if err != nil {
		return "", d.handleError(err)
	}

	return string(logs), nil
}

type ContainerStats struct {
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsage   uint64  `json:"memoryUsage"`
	MemoryLimit   uint64  `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetworkRx     uint64  `json:"networkRx"`
	NetworkTx     uint64  `json:"networkTx"`
}

// StatsJSON is used to decode the stats response from Docker API
type StatsJSON struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64   `json:"total_usage"`
			PercpuUsage []uint64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64   `json:"total_usage"`
			PercpuUsage []uint64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
}

func (d *DockerService) GetContainerStats(id string) (result *ContainerStats, err error) {
	if !d.IsConnected() {
		return nil, ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			result = nil
			err = ErrDockerNotConnected
		}
	}()
	stats, err := d.client.ContainerStats(d.ctx, id, false)
	if err != nil {
		return nil, d.handleError(err)
	}
	defer stats.Body.Close()

	var statsJSON StatsJSON
	if err := json.NewDecoder(stats.Body).Decode(&statsJSON); err != nil {
		return nil, err
	}

	// Tính CPU percent
	cpuDelta := float64(statsJSON.CPUStats.CPUUsage.TotalUsage - statsJSON.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(statsJSON.CPUStats.SystemUsage - statsJSON.PreCPUStats.SystemUsage)
	cpuPercent := 0.0
	numCPUs := len(statsJSON.CPUStats.CPUUsage.PercpuUsage)
	if numCPUs == 0 {
		numCPUs = 1
	}
	if systemDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * float64(numCPUs) * 100.0
	}

	// Tính Memory percent
	memPercent := 0.0
	if statsJSON.MemoryStats.Limit > 0 {
		memPercent = float64(statsJSON.MemoryStats.Usage) / float64(statsJSON.MemoryStats.Limit) * 100.0
	}

	// Tính Network
	var networkRx, networkTx uint64
	for _, net := range statsJSON.Networks {
		networkRx += net.RxBytes
		networkTx += net.TxBytes
	}

	return &ContainerStats{
		CPUPercent:    cpuPercent,
		MemoryUsage:   statsJSON.MemoryStats.Usage,
		MemoryLimit:   statsJSON.MemoryStats.Limit,
		MemoryPercent: memPercent,
		NetworkRx:     networkRx,
		NetworkTx:     networkTx,
	}, nil
}

func (d *DockerService) StreamContainerLogs(id string) (result io.ReadCloser, err error) {
	if !d.IsConnected() {
		return nil, ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			result = nil
			err = ErrDockerNotConnected
		}
	}()
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "100",
		Timestamps: true,
	}

	result, err = d.client.ContainerLogs(d.ctx, id, options)
	if err != nil {
		return nil, d.handleError(err)
	}
	return result, nil
}

// HijackedResponse wraps the Docker hijacked connection
type HijackedResponse struct {
	Conn   interface{ Write([]byte) (int, error) }
	Reader *io.PipeReader
	closer func()
}

func (h *HijackedResponse) Close() error {
	if h.closer != nil {
		h.closer()
	}
	return nil
}

// CreateExec tạo exec instance trong container
func (d *DockerService) CreateExec(containerID string) (result string, err error) {
	if !d.IsConnected() {
		return "", ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			result = ""
			err = ErrDockerNotConnected
		}
	}()
	execConfig := container.ExecOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Cmd:          []string{"/bin/sh"},
	}

	resp, err := d.client.ContainerExecCreate(d.ctx, containerID, execConfig)
	if err != nil {
		return "", d.handleError(err)
	}

	return resp.ID, nil
}

// AttachExec attach vào exec instance
func (d *DockerService) AttachExec(execID string) (result *HijackedResponse, err error) {
	if !d.IsConnected() {
		return nil, ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			result = nil
			err = ErrDockerNotConnected
		}
	}()
	resp, err := d.client.ContainerExecAttach(d.ctx, execID, container.ExecStartOptions{
		Tty: true,
	})
	if err != nil {
		return nil, d.handleError(err)
	}

	// Tạo pipe để đọc output
	pr, pw := io.Pipe()

	// Goroutine để copy từ hijacked connection sang pipe
	go func() {
		defer pw.Close()
		io.Copy(pw, resp.Reader)
	}()

	return &HijackedResponse{
		Conn:   resp.Conn,
		Reader: pr,
		closer: resp.Close,
	}, nil
}
