package services

import (
	"time"

	"github.com/docker/docker/api/types/network"
)

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

func (d *DockerService) ListNetworks() (result []NetworkInfo, err error) {
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
	networks, err := d.client.NetworkList(d.ctx, network.ListOptions{})
	if err != nil {
		return nil, d.handleError(err)
	}

	result = make([]NetworkInfo, 0, len(networks))
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

func (d *DockerService) GetNetwork(id string) (result *NetworkInfo, err error) {
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
	net, err := d.client.NetworkInspect(d.ctx, id, network.InspectOptions{})
	if err != nil {
		return nil, d.handleError(err)
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

func (d *DockerService) CreateNetwork(req CreateNetworkRequest) (result string, err error) {
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
		return "", d.handleError(err)
	}

	return resp.ID[:12], nil
}

func (d *DockerService) RemoveNetwork(id string) (err error) {
	if !d.IsConnected() {
		return ErrDockerNotConnected
	}
	defer func() {
		if r := recover(); r != nil {
			d.markDisconnected()
			err = ErrDockerNotConnected
		}
	}()
	err = d.client.NetworkRemove(d.ctx, id)
	return d.handleError(err)
}