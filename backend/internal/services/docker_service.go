package services

import (
	"context"
	"encoding/json"
	"io"
	"strconv"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
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

// ==================== CONTAINERS ====================

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

func (d *DockerService) ListContainers(all bool) ([]ContainerInfo, error) {
	containers, err := d.client.ContainerList(d.ctx, container.ListOptions{All: all})
	if err != nil {
		return nil, err
	}

	result := make([]ContainerInfo, 0, len(containers))
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

func (d *DockerService) GetContainer(id string) (*ContainerDetail, error) {
	c, err := d.client.ContainerInspect(d.ctx, id)
	if err != nil {
		return nil, err
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

func (d *DockerService) StartContainer(id string) error {
	return d.client.ContainerStart(d.ctx, id, container.StartOptions{})
}

func (d *DockerService) StopContainer(id string) error {
	timeout := 10
	return d.client.ContainerStop(d.ctx, id, container.StopOptions{Timeout: &timeout})
}

func (d *DockerService) RestartContainer(id string) error {
	timeout := 10
	return d.client.ContainerRestart(d.ctx, id, container.StopOptions{Timeout: &timeout})
}

func (d *DockerService) RemoveContainer(id string, force bool) error {
	return d.client.ContainerRemove(d.ctx, id, container.RemoveOptions{Force: force})
}

func (d *DockerService) GetContainerLogs(id string, tail string) (string, error) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
		Timestamps: true,
	}

	reader, err := d.client.ContainerLogs(d.ctx, id, options)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	logs, err := io.ReadAll(reader)
	if err != nil {
		return "", err
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

func (d *DockerService) GetContainerStats(id string) (*ContainerStats, error) {
	stats, err := d.client.ContainerStats(d.ctx, id, false)
	if err != nil {
		return nil, err
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

func (d *DockerService) StreamContainerLogs(id string) (io.ReadCloser, error) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "100",
		Timestamps: true,
	}

	return d.client.ContainerLogs(d.ctx, id, options)
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
func (d *DockerService) CreateExec(containerID string) (string, error) {
	execConfig := container.ExecOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Cmd:          []string{"/bin/sh"},
	}

	resp, err := d.client.ContainerExecCreate(d.ctx, containerID, execConfig)
	if err != nil {
		return "", err
	}

	return resp.ID, nil
}

// AttachExec attach vào exec instance
func (d *DockerService) AttachExec(execID string) (*HijackedResponse, error) {
	resp, err := d.client.ContainerExecAttach(d.ctx, execID, container.ExecStartOptions{
		Tty: true,
	})
	if err != nil {
		return nil, err
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

// ==================== IMAGES ====================

type ImageInfo struct {
	ID          string            `json:"id"`
	RepoTags    []string          `json:"repoTags"`
	RepoDigests []string          `json:"repoDigests"`
	Created     int64             `json:"created"`
	Size        int64             `json:"size"`
	VirtualSize int64             `json:"virtualSize"`
	Labels      map[string]string `json:"labels"`
	InUse       bool              `json:"inUse"`
	Containers  []string          `json:"containers"` // Container names using this image
}

func (d *DockerService) ListImages() ([]ImageInfo, error) {
	images, err := d.client.ImageList(d.ctx, image.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	// Lấy danh sách containers để kiểm tra image nào đang được sử dụng
	containers, err := d.client.ContainerList(d.ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	// Tạo map từ imageID -> list of container names
	imageUsage := make(map[string][]string)
	for _, c := range containers {
		// Lấy image ID (có thể là full ID hoặc tag)
		imgID := c.ImageID
		if len(imgID) > 19 {
			imgID = imgID[7:19] // Bỏ "sha256:" và lấy 12 ký tự
		}

		containerName := ""
		if len(c.Names) > 0 {
			containerName = c.Names[0][1:] // Bỏ dấu / ở đầu
		}

		imageUsage[imgID] = append(imageUsage[imgID], containerName)

		// Cũng map theo image name/tag
		imageUsage[c.Image] = append(imageUsage[c.Image], containerName)
	}

	result := make([]ImageInfo, 0, len(images))
	for _, img := range images {
		id := img.ID
		if len(id) > 19 {
			id = id[7:19] // Bỏ "sha256:" và lấy 12 ký tự
		}

		// Kiểm tra image có đang được sử dụng không
		usedByContainers := imageUsage[id]
		// Cũng kiểm tra theo repo tags
		for _, tag := range img.RepoTags {
			if containers, ok := imageUsage[tag]; ok {
				for _, c := range containers {
					// Tránh duplicate
					found := false
					for _, existing := range usedByContainers {
						if existing == c {
							found = true
							break
						}
					}
					if !found {
						usedByContainers = append(usedByContainers, c)
					}
				}
			}
		}

		result = append(result, ImageInfo{
			ID:          id,
			RepoTags:    img.RepoTags,
			RepoDigests: img.RepoDigests,
			Created:     img.Created,
			Size:        img.Size,
			VirtualSize: img.Size,
			Labels:      img.Labels,
			InUse:       len(usedByContainers) > 0,
			Containers:  usedByContainers,
		})
	}

	return result, nil
}

func (d *DockerService) GetImage(id string) (*ImageInfo, error) {
	img, _, err := d.client.ImageInspectWithRaw(d.ctx, id)
	if err != nil {
		return nil, err
	}

	imgID := img.ID
	if len(imgID) > 19 {
		imgID = imgID[7:19]
	}

	created, err := strconv.ParseInt(img.Created, 10, 64)
	if err != nil {
		return nil, err
	}

	return &ImageInfo{
		ID:          imgID,
		RepoTags:    img.RepoTags,
		RepoDigests: img.RepoDigests,
		Created:     created, // img.Created is a string (not time.Time), so assign directly
		Size:        img.Size,
		VirtualSize: img.Size,
		Labels:      img.Config.Labels,
	}, nil
}

func (d *DockerService) RemoveImage(id string, force bool) error {
	_, err := d.client.ImageRemove(d.ctx, id, image.RemoveOptions{Force: force})
	return err
}

func (d *DockerService) PullImage(refStr string) error {
	reader, err := d.client.ImagePull(d.ctx, refStr, image.PullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()

	// Đọc hết response để hoàn thành pull
	_, err = io.Copy(io.Discard, reader)
	return err
}

// BulkDeleteResult kết quả xóa nhiều images
type BulkDeleteResult struct {
	Success []string     `json:"success"` // IDs đã xóa thành công
	Failed  []FailedItem `json:"failed"`  // IDs xóa thất bại
	Total   int          `json:"total"`   // Tổng số images yêu cầu xóa
	Deleted int          `json:"deleted"` // Số images đã xóa thành công
}

type FailedItem struct {
	ID    string `json:"id"`
	Error string `json:"error"`
}

// RemoveImages xóa nhiều images cùng lúc
func (d *DockerService) RemoveImages(ids []string, force bool) *BulkDeleteResult {
	result := &BulkDeleteResult{
		Success: make([]string, 0),
		Failed:  make([]FailedItem, 0),
		Total:   len(ids),
	}

	for _, id := range ids {
		_, err := d.client.ImageRemove(d.ctx, id, image.RemoveOptions{Force: force})
		if err != nil {
			result.Failed = append(result.Failed, FailedItem{
				ID:    id,
				Error: err.Error(),
			})
		} else {
			result.Success = append(result.Success, id)
		}
	}

	result.Deleted = len(result.Success)
	return result
}

// ==================== NETWORKS ====================

type NetworkInfo struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Scope      string            `json:"scope"`
	Internal   bool              `json:"internal"`
	Attachable bool              `json:"attachable"`
	IPAM       IPAMInfo          `json:"ipam"`
	Containers map[string]string `json:"containers"`
	Labels     map[string]string `json:"labels"`
	Created    time.Time         `json:"created"`
}

type IPAMInfo struct {
	Driver string       `json:"driver"`
	Config []IPAMConfig `json:"config"`
}

type IPAMConfig struct {
	Subnet  string `json:"subnet"`
	Gateway string `json:"gateway"`
}

func (d *DockerService) ListNetworks() ([]NetworkInfo, error) {
	networks, err := d.client.NetworkList(d.ctx, network.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]NetworkInfo, 0, len(networks))
	for _, net := range networks {
		id := net.ID
		if len(id) > 12 {
			id = id[:12]
		}

		containers := make(map[string]string)
		for cID, endpoint := range net.Containers {
			containers[cID[:12]] = endpoint.Name
		}

		ipamConfigs := make([]IPAMConfig, 0, len(net.IPAM.Config))
		for _, cfg := range net.IPAM.Config {
			ipamConfigs = append(ipamConfigs, IPAMConfig{
				Subnet:  cfg.Subnet,
				Gateway: cfg.Gateway,
			})
		}

		result = append(result, NetworkInfo{
			ID:         id,
			Name:       net.Name,
			Driver:     net.Driver,
			Scope:      net.Scope,
			Internal:   net.Internal,
			Attachable: net.Attachable,
			IPAM: IPAMInfo{
				Driver: net.IPAM.Driver,
				Config: ipamConfigs,
			},
			Containers: containers,
			Labels:     net.Labels,
			Created:    net.Created,
		})
	}

	return result, nil
}

func (d *DockerService) GetNetwork(id string) (*NetworkInfo, error) {
	net, err := d.client.NetworkInspect(d.ctx, id, network.InspectOptions{})
	if err != nil {
		return nil, err
	}

	netID := net.ID
	if len(netID) > 12 {
		netID = netID[:12]
	}

	containers := make(map[string]string)
	for cID, endpoint := range net.Containers {
		shortID := cID
		if len(shortID) > 12 {
			shortID = shortID[:12]
		}
		containers[shortID] = endpoint.Name
	}

	ipamConfigs := make([]IPAMConfig, 0, len(net.IPAM.Config))
	for _, cfg := range net.IPAM.Config {
		ipamConfigs = append(ipamConfigs, IPAMConfig{
			Subnet:  cfg.Subnet,
			Gateway: cfg.Gateway,
		})
	}

	return &NetworkInfo{
		ID:         netID,
		Name:       net.Name,
		Driver:     net.Driver,
		Scope:      net.Scope,
		Internal:   net.Internal,
		Attachable: net.Attachable,
		IPAM: IPAMInfo{
			Driver: net.IPAM.Driver,
			Config: ipamConfigs,
		},
		Containers: containers,
		Labels:     net.Labels,
		Created:    net.Created,
	}, nil
}

type CreateNetworkRequest struct {
	Name       string `json:"name"`
	Driver     string `json:"driver"`
	Internal   bool   `json:"internal"`
	Attachable bool   `json:"attachable"`
}

func (d *DockerService) CreateNetwork(req CreateNetworkRequest) (string, error) {
	driver := req.Driver
	if driver == "" {
		driver = "bridge"
	}

	resp, err := d.client.NetworkCreate(d.ctx, req.Name, network.CreateOptions{
		Driver:     driver,
		Internal:   req.Internal,
		Attachable: req.Attachable,
	})
	if err != nil {
		return "", err
	}

	return resp.ID[:12], nil
}

func (d *DockerService) RemoveNetwork(id string) error {
	return d.client.NetworkRemove(d.ctx, id)
}

// ==================== VOLUMES ====================

type VolumeInfo struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	CreatedAt  string            `json:"createdAt"`
	Labels     map[string]string `json:"labels"`
	Scope      string            `json:"scope"`
	UsageData  *VolumeUsage      `json:"usageData,omitempty"`
}

type VolumeUsage struct {
	Size     int64 `json:"size"`
	RefCount int64 `json:"refCount"`
}

func (d *DockerService) ListVolumes() ([]VolumeInfo, error) {
	volumes, err := d.client.VolumeList(d.ctx, volume.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]VolumeInfo, 0, len(volumes.Volumes))
	for _, vol := range volumes.Volumes {
		var usage *VolumeUsage
		if vol.UsageData != nil {
			usage = &VolumeUsage{
				Size:     vol.UsageData.Size,
				RefCount: vol.UsageData.RefCount,
			}
		}

		result = append(result, VolumeInfo{
			Name:       vol.Name,
			Driver:     vol.Driver,
			Mountpoint: vol.Mountpoint,
			CreatedAt:  vol.CreatedAt,
			Labels:     vol.Labels,
			Scope:      vol.Scope,
			UsageData:  usage,
		})
	}

	return result, nil
}

func (d *DockerService) GetVolume(name string) (*VolumeInfo, error) {
	vol, err := d.client.VolumeInspect(d.ctx, name)
	if err != nil {
		return nil, err
	}

	var usage *VolumeUsage
	if vol.UsageData != nil {
		usage = &VolumeUsage{
			Size:     vol.UsageData.Size,
			RefCount: vol.UsageData.RefCount,
		}
	}

	return &VolumeInfo{
		Name:       vol.Name,
		Driver:     vol.Driver,
		Mountpoint: vol.Mountpoint,
		CreatedAt:  vol.CreatedAt,
		Labels:     vol.Labels,
		Scope:      vol.Scope,
		UsageData:  usage,
	}, nil
}

type CreateVolumeRequest struct {
	Name   string            `json:"name"`
	Driver string            `json:"driver"`
	Labels map[string]string `json:"labels"`
}

func (d *DockerService) CreateVolume(req CreateVolumeRequest) (*VolumeInfo, error) {
	driver := req.Driver
	if driver == "" {
		driver = "local"
	}

	vol, err := d.client.VolumeCreate(d.ctx, volume.CreateOptions{
		Name:   req.Name,
		Driver: driver,
		Labels: req.Labels,
	})
	if err != nil {
		return nil, err
	}

	return &VolumeInfo{
		Name:       vol.Name,
		Driver:     vol.Driver,
		Mountpoint: vol.Mountpoint,
		CreatedAt:  vol.CreatedAt,
		Labels:     vol.Labels,
		Scope:      vol.Scope,
	}, nil
}

func (d *DockerService) RemoveVolume(name string, force bool) error {
	return d.client.VolumeRemove(d.ctx, name, force)
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
