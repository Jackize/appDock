package services

import (
	"encoding/base64"
	"encoding/json"

	"github.com/docker/docker/api/types/registry"
)

// EncodeRegistryAuth builds the RegistryAuth string expected by the Docker Engine API.
func EncodeRegistryAuth(username, password string) string {
	if username == "" && password == "" {
		return ""
	}
	cfg := registry.AuthConfig{
		Username: username,
		Password: password,
	}
	b, err := json.Marshal(cfg)
	if err != nil {
		return ""
	}
	return base64.StdEncoding.EncodeToString(b)
}
