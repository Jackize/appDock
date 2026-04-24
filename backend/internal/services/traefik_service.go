package services

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type TraefikService struct {
	dataDir     string
	composePath string
}

func NewTraefikService(dataDir string) (*TraefikService, error) {
	dir := filepath.Join(dataDir, "traefik")
	if abs, err := filepath.Abs(dir); err == nil {
		dir = abs
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	letsencryptDir := filepath.Join(dir, "letsencrypt")
	if err := os.MkdirAll(letsencryptDir, 0755); err != nil {
		return nil, err
	}
	acme := filepath.Join(letsencryptDir, "acme.json")
	if _, err := os.Stat(acme); os.IsNotExist(err) {
		if err := os.WriteFile(acme, []byte("{}"), 0600); err != nil {
			return nil, err
		}
	} else {
		_ = os.Chmod(acme, 0600)
	}

	return &TraefikService{
		dataDir:     dir,
		composePath: filepath.Join(dir, "docker-compose.yml"),
	}, nil
}

func (t *TraefikService) ensureProxyNetwork(ctx context.Context) (string, error) {
	// Idempotent: create fails if exists; ignore that case
	cmd := exec.CommandContext(ctx, "docker", "network", "create", "proxy")
	cmd.Dir = t.dataDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		s := string(out)
		if strings.Contains(s, "already exists") {
			return s, nil
		}
		return s, fmt.Errorf("docker network create proxy: %w: %s", err, strings.TrimSpace(s))
	}
	return string(out), nil
}

func (t *TraefikService) writeCompose(domain, email, cfToken, dashboardHost string) error {
	labels := ""
	if strings.TrimSpace(dashboardHost) != "" {
		bt := "`"
		labels = "\n    labels:\n" +
			"      - \"traefik.enable=true\"\n" +
			fmt.Sprintf("      - \"traefik.http.routers.traefik.rule=Host(%s%s%s)\"\n", bt, strings.TrimSpace(dashboardHost), bt) +
			"      - \"traefik.http.routers.traefik.entrypoints=websecure\"\n" +
			"      - \"traefik.http.routers.traefik.tls=true\"\n" +
			"      - \"traefik.http.routers.traefik.tls.certresolver=le\"\n" +
			"      - \"traefik.http.services.traefik.loadbalancer.server.port=8080\""
	}

	compose := fmt.Sprintf(`services:
  traefik:
    image: traefik:v3.6
    container_name: appdock-traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.email=%s"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.le.acme.dnschallenge=true"
      - "--certificatesresolvers.le.acme.dnschallenge.provider=cloudflare"
      - "--certificatesresolvers.le.acme.dnschallenge.resolvers=1.1.1.1:53,8.8.8.8:53"
    environment:
      - CF_DNS_API_TOKEN=%s
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - proxy%s

networks:
  proxy:
    external: true
`, strings.TrimSpace(email), strings.TrimSpace(cfToken), labels)

	return os.WriteFile(t.composePath, []byte(compose), 0644)
}

func (t *TraefikService) compose(ctx context.Context, args ...string) (string, error) {
	full := append([]string{"compose", "-p", "appdock-traefik", "-f", t.composePath}, args...)
	cmd := exec.CommandContext(ctx, "docker", full...)
	cmd.Dir = t.dataDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("docker compose %s: %w", strings.Join(args, " "), err)
	}
	return string(out), nil
}

func (t *TraefikService) Up(domain, email, cfToken, dashboardHost string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if _, err := exec.LookPath("docker"); err != nil {
		return "", fmt.Errorf("docker not found in PATH")
	}
	if err := t.writeCompose(domain, email, cfToken, dashboardHost); err != nil {
		return "", err
	}
	if _, err := t.ensureProxyNetwork(ctx); err != nil {
		return "", err
	}
	out, err := t.compose(ctx, "up", "-d")
	return out, err
}

func (t *TraefikService) Down() (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	if _, err := os.Stat(t.composePath); err != nil {
		return "", nil
	}
	return t.compose(ctx, "down")
}

func (t *TraefikService) Logs(tail string) (string, error) {
	if tail == "" {
		tail = "200"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "logs", "--tail", tail, "appdock-traefik")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("docker logs: %w", err)
	}
	return string(out), nil
}

func (t *TraefikService) Status() (running bool, errMsg string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "inspect", "-f", "{{.State.Running}}", "appdock-traefik")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false, strings.TrimSpace(string(out))
	}
	return strings.TrimSpace(string(out)) == "true", ""
}

