package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

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
