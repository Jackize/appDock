package services

import (
	"testing"

	"appdock/internal/models"
)

func TestProjectAccessInviteAcceptance(t *testing.T) {
	store, err := NewProjectAccessStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := store.EnsureOwner("project-1", ProjectIdentity{Username: "admin"}); err != nil {
		t.Fatal(err)
	}
	if !store.Can("project-1", ProjectIdentity{Username: "admin"}, models.ProjectRoleOwner) {
		t.Fatal("admin should be owner")
	}
	token, invite, err := store.CreateInvite("project-1", "dev@example.com", models.ProjectRoleViewer, "admin")
	if err != nil {
		t.Fatal(err)
	}
	if invite.Email != "dev@example.com" {
		t.Fatalf("invite email = %q", invite.Email)
	}
	_, member, err := store.AcceptInvite(token)
	if err != nil {
		t.Fatal(err)
	}
	if member.Role != models.ProjectRoleViewer {
		t.Fatalf("member role = %q", member.Role)
	}
	if !store.Can("project-1", ProjectIdentity{Email: "dev@example.com"}, models.ProjectRoleViewer) {
		t.Fatal("accepted email should be viewer")
	}
	if store.Can("project-1", ProjectIdentity{Email: "dev@example.com"}, models.ProjectRoleDeployer) {
		t.Fatal("viewer should not deploy")
	}
}
