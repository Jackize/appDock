package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var (
	ErrComposeLocalOnly   = errors.New("compose deploy is only supported on the local Docker server from this UI")
	ErrComposeInvalidID   = errors.New("invalid compose stack id")
	ErrComposeYAMLMissing = errors.New("compose yaml is empty")
)

var stackIDRe = regexp.MustCompile(`^[a-f0-9-]{36}$`)

type ComposeService struct {
	stackRoot string
}

func NewComposeService(dataDir string) (*ComposeService, error) {
	root := filepath.Join(dataDir, "compose-stack-files")
	if err := os.MkdirAll(root, 0755); err != nil {
		return nil, err
	}
	return &ComposeService{stackRoot: root}, nil
}

func (c *ComposeService) workDir(stackID string) string {
	return filepath.Join(c.stackRoot, stackID)
}

func (c *ComposeService) WriteFiles(stackID, composeYAML, envContent string) error {
	if !stackIDRe.MatchString(stackID) {
		return ErrComposeInvalidID
	}
	if strings.TrimSpace(composeYAML) == "" {
		return ErrComposeYAMLMissing
	}
	dir := c.workDir(stackID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	composePath := filepath.Join(dir, "docker-compose.yml")
	if err := os.WriteFile(composePath, []byte(composeYAML), 0644); err != nil {
		return err
	}
	envPath := filepath.Join(dir, ".env")
	if strings.TrimSpace(envContent) != "" {
		if err := os.WriteFile(envPath, []byte(envContent), 0600); err != nil {
			return err
		}
	} else {
		_ = os.Remove(envPath)
	}
	return nil
}

func (c *ComposeService) runCompose(ctx context.Context, composeProjectName, stackID string, args ...string) ([]byte, error) {
	if !stackIDRe.MatchString(stackID) {
		return nil, ErrComposeInvalidID
	}
	dir := c.workDir(stackID)
	full := append([]string{
		"compose",
		"-p", composeProjectName,
		"-f", "docker-compose.yml",
		"--project-directory", dir,
	}, args...)
	cmd := exec.CommandContext(ctx, "docker", full...)
	cmd.Dir = dir
	return cmd.CombinedOutput()
}

func (c *ComposeService) Deploy(ctx context.Context, composeProjectName, stackID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Minute)
	defer cancel()
	out, err := c.runCompose(ctx, composeProjectName, stackID, "up", "-d")
	return string(out), err
}

func (c *ComposeService) Undeploy(ctx context.Context, composeProjectName, stackID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	defer cancel()
	out, err := c.runCompose(ctx, composeProjectName, stackID, "down", "--remove-orphans")
	return string(out), err
}

func (c *ComposeService) RemoveWorkDir(stackID string) error {
	if !stackIDRe.MatchString(stackID) {
		return ErrComposeInvalidID
	}
	dir := c.workDir(stackID)
	if fi, err := os.Stat(dir); err != nil || !fi.IsDir() {
		return nil
	}
	return os.RemoveAll(dir)
}

// ValidateDockerCompose checks that the docker compose CLI is available.
func (c *ComposeService) ValidateDockerCompose() error {
	cmd := exec.Command("docker", "compose", "version")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker compose: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
