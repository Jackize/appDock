package services

import (
	"io"
	"strconv"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
)
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
	img, err := d.client.ImageInspect(d.ctx, id)
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