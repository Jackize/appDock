package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/gin-gonic/gin"
)

type DockerHandler struct {
	client *client.Client
	ctx    context.Context
}

func NewDockerHandler(socketPath string) (*DockerHandler, error) {
	cli, err := client.NewClientWithOpts(
		client.WithHost("unix://"+socketPath),
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	_, err = cli.Ping(ctx)
	if err != nil {
		cli.Close()
		return nil, err
	}

	return &DockerHandler{
		client: cli,
		ctx:    ctx,
	}, nil
}

// ==================== System ====================

func (h *DockerHandler) GetInfo(c *gin.Context) {
	info, err := h.client.Info(h.ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *DockerHandler) GetVersion(c *gin.Context) {
	version, err := h.client.ServerVersion(h.ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, version)
}

// ==================== Containers ====================

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

func (h *DockerHandler) ListContainers(c *gin.Context) {
	all := c.Query("all") == "true"
	containers, err := h.client.ContainerList(h.ctx, container.ListOptions{All: all})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]ContainerInfo, 0, len(containers))
	for _, ctr := range containers {
		name := ""
		if len(ctr.Names) > 0 {
			name = ctr.Names[0][1:]
		}

		ports := make([]PortMapping, 0, len(ctr.Ports))
		for _, p := range ctr.Ports {
			ports = append(ports, PortMapping{
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
				IP:          p.IP,
			})
		}

		result = append(result, ContainerInfo{
			ID:      ctr.ID[:12],
			Name:    name,
			Image:   ctr.Image,
			Status:  ctr.Status,
			State:   ctr.State,
			Created: ctr.Created,
			Ports:   ports,
			Labels:  ctr.Labels,
		})
	}

	c.JSON(http.StatusOK, result)
}

func (h *DockerHandler) GetContainer(c *gin.Context) {
	id := c.Param("id")
	ctr, err := h.client.ContainerInspect(h.ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ctr)
}

func (h *DockerHandler) StartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.client.ContainerStart(h.ctx, id, container.StartOptions{}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container started"})
}

func (h *DockerHandler) StopContainer(c *gin.Context) {
	id := c.Param("id")
	timeout := 10
	if err := h.client.ContainerStop(h.ctx, id, container.StopOptions{Timeout: &timeout}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container stopped"})
}

func (h *DockerHandler) RestartContainer(c *gin.Context) {
	id := c.Param("id")
	timeout := 10
	if err := h.client.ContainerRestart(h.ctx, id, container.StopOptions{Timeout: &timeout}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container restarted"})
}

func (h *DockerHandler) RemoveContainer(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := h.client.ContainerRemove(h.ctx, id, container.RemoveOptions{Force: force}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container removed"})
}

func (h *DockerHandler) GetContainerLogs(c *gin.Context) {
	id := c.Param("id")
	tail := c.DefaultQuery("tail", "100")

	reader, err := h.client.ContainerLogs(h.ctx, id, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
		Timestamps: true,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer reader.Close()

	logs, err := io.ReadAll(reader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": string(logs)})
}

type ContainerStats struct {
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsage   uint64  `json:"memoryUsage"`
	MemoryLimit   uint64  `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetworkRx     uint64  `json:"networkRx"`
	NetworkTx     uint64  `json:"networkTx"`
}

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

func (h *DockerHandler) GetContainerStats(c *gin.Context) {
	id := c.Param("id")
	stats, err := h.client.ContainerStats(h.ctx, id, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer stats.Body.Close()

	var statsJSON StatsJSON
	if err := json.NewDecoder(stats.Body).Decode(&statsJSON); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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

	memPercent := 0.0
	if statsJSON.MemoryStats.Limit > 0 {
		memPercent = float64(statsJSON.MemoryStats.Usage) / float64(statsJSON.MemoryStats.Limit) * 100.0
	}

	var networkRx, networkTx uint64
	for _, net := range statsJSON.Networks {
		networkRx += net.RxBytes
		networkTx += net.TxBytes
	}

	c.JSON(http.StatusOK, ContainerStats{
		CPUPercent:    cpuPercent,
		MemoryUsage:   statsJSON.MemoryStats.Usage,
		MemoryLimit:   statsJSON.MemoryStats.Limit,
		MemoryPercent: memPercent,
		NetworkRx:     networkRx,
		NetworkTx:     networkTx,
	})
}

// ==================== Images ====================

type ImageInfo struct {
	ID         string            `json:"id"`
	RepoTags   []string          `json:"repoTags"`
	Created    int64             `json:"created"`
	Size       int64             `json:"size"`
	Labels     map[string]string `json:"labels"`
}

func (h *DockerHandler) ListImages(c *gin.Context) {
	images, err := h.client.ImageList(h.ctx, image.ListOptions{All: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]ImageInfo, 0, len(images))
	for _, img := range images {
		result = append(result, ImageInfo{
			ID:       img.ID[7:19],
			RepoTags: img.RepoTags,
			Created:  img.Created,
			Size:     img.Size,
			Labels:   img.Labels,
		})
	}

	c.JSON(http.StatusOK, result)
}

func (h *DockerHandler) GetImage(c *gin.Context) {
	id := c.Param("id")
	img, _, err := h.client.ImageInspectWithRaw(h.ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, img)
}

func (h *DockerHandler) RemoveImage(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	_, err := h.client.ImageRemove(h.ctx, id, image.RemoveOptions{Force: force})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Image removed"})
}

// ==================== Networks ====================

type NetworkInfo struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Scope      string            `json:"scope"`
	Internal   bool              `json:"internal"`
	Attachable bool              `json:"attachable"`
	Labels     map[string]string `json:"labels"`
}

func (h *DockerHandler) ListNetworks(c *gin.Context) {
	networks, err := h.client.NetworkList(h.ctx, network.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]NetworkInfo, 0, len(networks))
	for _, net := range networks {
		result = append(result, NetworkInfo{
			ID:         net.ID[:12],
			Name:       net.Name,
			Driver:     net.Driver,
			Scope:      net.Scope,
			Internal:   net.Internal,
			Attachable: net.Attachable,
			Labels:     net.Labels,
		})
	}

	c.JSON(http.StatusOK, result)
}

func (h *DockerHandler) GetNetwork(c *gin.Context) {
	id := c.Param("id")
	net, err := h.client.NetworkInspect(h.ctx, id, network.InspectOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, net)
}

type CreateNetworkRequest struct {
	Name       string `json:"name" binding:"required"`
	Driver     string `json:"driver"`
	Internal   bool   `json:"internal"`
	Attachable bool   `json:"attachable"`
}

func (h *DockerHandler) CreateNetwork(c *gin.Context) {
	var req CreateNetworkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	driver := req.Driver
	if driver == "" {
		driver = "bridge"
	}

	resp, err := h.client.NetworkCreate(h.ctx, req.Name, network.CreateOptions{
		Driver:     driver,
		Internal:   req.Internal,
		Attachable: req.Attachable,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": resp.ID, "message": "Network created"})
}

func (h *DockerHandler) RemoveNetwork(c *gin.Context) {
	id := c.Param("id")
	if err := h.client.NetworkRemove(h.ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Network removed"})
}

// ==================== Volumes ====================

type VolumeInfo struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels"`
	Scope      string            `json:"scope"`
}

func (h *DockerHandler) ListVolumes(c *gin.Context) {
	volumes, err := h.client.VolumeList(h.ctx, volume.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]VolumeInfo, 0, len(volumes.Volumes))
	for _, vol := range volumes.Volumes {
		result = append(result, VolumeInfo{
			Name:       vol.Name,
			Driver:     vol.Driver,
			Mountpoint: vol.Mountpoint,
			Labels:     vol.Labels,
			Scope:      vol.Scope,
		})
	}

	c.JSON(http.StatusOK, result)
}

func (h *DockerHandler) GetVolume(c *gin.Context) {
	name := c.Param("name")
	vol, err := h.client.VolumeInspect(h.ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, vol)
}

type CreateVolumeRequest struct {
	Name   string            `json:"name" binding:"required"`
	Driver string            `json:"driver"`
	Labels map[string]string `json:"labels"`
}

func (h *DockerHandler) CreateVolume(c *gin.Context) {
	var req CreateVolumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	driver := req.Driver
	if driver == "" {
		driver = "local"
	}

	vol, err := h.client.VolumeCreate(h.ctx, volume.CreateOptions{
		Name:   req.Name,
		Driver: driver,
		Labels: req.Labels,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, vol)
}

func (h *DockerHandler) RemoveVolume(c *gin.Context) {
	name := c.Param("name")
	force := c.Query("force") == "true"
	if err := h.client.VolumeRemove(h.ctx, name, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Volume removed"})
}

func parseInt(s string, def int) int {
	if i, err := strconv.Atoi(s); err == nil {
		return i
	}
	return def
}
