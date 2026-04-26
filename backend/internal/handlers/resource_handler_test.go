package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

func TestLiveResourceStatusReflectsContainerState(t *testing.T) {
	runtimes := composeProjectRuntimes([]services.ContainerInfo{
		{
			State:  "exited",
			Labels: map[string]string{composeProjectLabel: "demo"},
		},
	})
	if got := liveResourceStatus(models.ResourceStatusDeployed, runtimes["demo"], true); got != models.ResourceStatusStopped {
		t.Fatalf("stopped containers should mark deployed resource stopped, got %q", got)
	}

	runtimes = composeProjectRuntimes([]services.ContainerInfo{
		{
			State:  "running",
			Labels: map[string]string{composeProjectLabel: "demo"},
		},
	})
	if got := liveResourceStatus(models.ResourceStatusStopped, runtimes["demo"], true); got != models.ResourceStatusDeployed {
		t.Fatalf("running containers should mark stopped resource deployed, got %q", got)
	}

	if got := liveResourceStatus(models.ResourceStatusDeployed, composeProjectRuntime{}, false); got != models.ResourceStatusStopped {
		t.Fatalf("missing containers should mark deployed resource stopped, got %q", got)
	}

	if got := liveResourceStatus(models.ResourceStatusDeploying, composeProjectRuntime{}, false); got != models.ResourceStatusDeploying {
		t.Fatalf("deploying status should be preserved while deployment is in progress, got %q", got)
	}
}

func TestResourceListRequiresProjectAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dataDir := t.TempDir()
	projects, err := services.NewProjectStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	envs, err := services.NewEnvironmentStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	resources, err := services.NewResourceStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	access, err := services.NewProjectAccessStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	workspace, err := services.NewWorkspaceService(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	project, err := projects.CreateForOwner(models.CreateProjectRequest{Name: "Demo"}, "admin", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := access.EnsureOwner(project.ID, services.ProjectIdentity{Username: "admin"}); err != nil {
		t.Fatal(err)
	}
	env, err := envs.EnsureDefault(project, workspace)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := resources.Create(project, env, models.CreateResourceRequest{Name: "Web", Type: models.ResourceTypeImage, Image: "nginx:alpine"}, workspace); err != nil {
		t.Fatal(err)
	}

	handler := NewResourceHandler(projects, envs, resources, access, workspace, nil, nil)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("username", "someone-else")
		c.Next()
	})
	router.GET("/environments/:environmentId/resources", handler.List)

	req := httptest.NewRequest(http.MethodGet, "/environments/"+env.ID+"/resources", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}
