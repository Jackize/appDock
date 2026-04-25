package services

import (
	"strings"
	"testing"

	"appdock/internal/models"
)

func TestResourceRendererAddsAppDockAndTraefikLabels(t *testing.T) {
	renderer := NewResourceRenderer(NewCatalogService())
	project := models.NewProject("Demo", "", "local", nil, "admin", "", "demo", "admin")
	env := models.NewEnvironment(project.ID, "Production", "", "local", "production", "appdock_demo_production", t.TempDir())
	res := models.NewResource(project.ID, env.ID, "local", "Web", "web", "ad_demo_production_web", t.TempDir(), models.CreateResourceRequest{
		Type:         models.ResourceTypeImage,
		Image:        "nginx:alpine",
		ServiceName:  "web",
		HasHTTP:      true,
		Domain:       "web.example.com",
		InternalPort: 80,
	})
	out, err := renderer.Render(project, env, res)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"appdock.project_id=" + project.ID,
		"appdock.environment_id=" + env.ID,
		"appdock.resource_id=" + res.ID,
		"traefik.enable=true",
		"Host(`web.example.com`)",
		"websecure",
		"tls.certresolver=le",
		"loadbalancer.server.port=80",
		"proxy:",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("rendered compose missing %q:\n%s", want, out)
		}
	}
}

func TestResourceRendererUsesPlainHTTPForLocalDomain(t *testing.T) {
	renderer := NewResourceRenderer(NewCatalogService())
	project := models.NewProject("Demo", "", "local", nil, "admin", "", "demo", "admin")
	env := models.NewEnvironment(project.ID, "Production", "", "local", "production", "appdock_demo_production", t.TempDir())
	res := models.NewResource(project.ID, env.ID, "local", "pgAdmin", "pgadmin", "ad_demo_production_pgadmin", t.TempDir(), models.CreateResourceRequest{
		Type:         models.ResourceTypeImage,
		Image:        "dpage/pgadmin4:latest",
		ServiceName:  "pgadmin",
		HasHTTP:      true,
		Domain:       "pgadmin.localhost",
		InternalPort: 80,
	})
	out, err := renderer.Render(project, env, res)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "entrypoints=web") {
		t.Fatalf("local domain should use web entrypoint:\n%s", out)
	}
	if strings.Contains(out, "tls.certresolver") || strings.Contains(out, "entrypoints=websecure") {
		t.Fatalf("local domain should not enable TLS labels:\n%s", out)
	}
}
