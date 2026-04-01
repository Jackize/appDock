package services

import (
	"github.com/docker/docker/api/types/volume"
)

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

func (d *DockerService) ListVolumes() (result []VolumeInfo, err error) {
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
	volumes, err := d.client.VolumeList(d.ctx, volume.ListOptions{})
	if err != nil {
		return nil, d.handleError(err)
	}

	result = make([]VolumeInfo, 0, len(volumes.Volumes))
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

func (d *DockerService) GetVolume(name string) (result *VolumeInfo, err error) {
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
	vol, err := d.client.VolumeInspect(d.ctx, name)
	if err != nil {
		return nil, d.handleError(err)
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

func (d *DockerService) CreateVolume(req CreateVolumeRequest) (result *VolumeInfo, err error) {
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
		return nil, d.handleError(err)
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

func (d *DockerService) RemoveVolume(name string, force bool) (err error) {
	if !d.IsConnected() {
		return ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			err = ErrDockerNotConnected
		}
	}()
	err = d.client.VolumeRemove(d.ctx, name, force)
	return d.handleError(err)
}
