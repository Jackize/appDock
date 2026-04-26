package services

import (
	"strings"
	"testing"

	"appdock/internal/models"
)

func TestWorkspaceEnvironmentDir(t *testing.T) {
	ws, err := NewWorkspaceService(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	project := models.NewProject("API Production", "", "local", nil, "User@example.com", "user@example.com", Slugify("API Production"), Slugify("User@example.com"))
	env := models.NewEnvironment(project.ID, "Production", "", "local", "production", "appdock_abc_production", "")
	dir := ws.EnvironmentDir(project, env.Slug)
	if !strings.Contains(dir, "/user-example-com/api-production-"+ShortID(project.ID)+"/production") {
		t.Fatalf("unexpected environment dir %q", dir)
	}
}
