package handlers

import (
	"errors"
	"net/http"
	"net/url"

	"appdock/internal/models"
	"appdock/internal/services"

	"github.com/gin-gonic/gin"
)

type ProjectHandler struct {
	store         *services.ProjectStore
	serverStore   *services.ServerStore
	registryStore *services.RegistryProjectStore
	envs          *services.EnvironmentStore
	resources     *services.ResourceStore
	access        *services.ProjectAccessStore
	workspace     *services.WorkspaceService
	email         services.EmailService
}

func NewProjectHandler(
	store *services.ProjectStore,
	serverStore *services.ServerStore,
	registryStore *services.RegistryProjectStore,
	envs *services.EnvironmentStore,
	resources *services.ResourceStore,
	access *services.ProjectAccessStore,
	workspace *services.WorkspaceService,
	email services.EmailService,
) *ProjectHandler {
	return &ProjectHandler{
		store:         store,
		serverStore:   serverStore,
		registryStore: registryStore,
		envs:          envs,
		resources:     resources,
		access:        access,
		workspace:     workspace,
		email:         email,
	}
}

func (h *ProjectHandler) validateServerID(serverID string) error {
	if serverID == "" || serverID == "local" {
		return nil
	}
	if h.serverStore == nil {
		return nil
	}
	if _, err := h.serverStore.Get(serverID); err != nil {
		return err
	}
	return nil
}

func (h *ProjectHandler) validateRegistryProjectID(id string) error {
	if id == "" {
		return nil
	}
	if h.registryStore == nil {
		return errors.New("registry projects store unavailable")
	}
	_, err := h.registryStore.Get(id)
	return err
}

func (h *ProjectHandler) ListProjects(c *gin.Context) {
	list := h.store.List()
	if h.access == nil {
		c.JSON(http.StatusOK, list)
		return
	}
	ident := CurrentIdentity(c)
	filtered := make([]*models.Project, 0, len(list))
	for _, p := range list {
		if h.access.Can(p.ID, ident, models.ProjectRoleViewer) || !h.access.HasAnyMember(p.ID) {
			filtered = append(filtered, p)
		}
	}
	c.JSON(http.StatusOK, filtered)
}

func (h *ProjectHandler) GetProject(c *gin.Context) {
	id := c.Param("id")
	p, err := h.store.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if h.access != nil && !h.access.Can(p.ID, CurrentIdentity(c), models.ProjectRoleViewer) && h.access.HasAnyMember(p.ID) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *ProjectHandler) CreateProject(c *gin.Context) {
	var req models.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	serverID := req.ServerID
	if serverID == "" {
		serverID = "local"
	}
	if err := h.validateServerID(serverID); err != nil {
		if err == services.ErrServerNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	req.ServerID = serverID

	if err := h.validateRegistryProjectID(req.RegistryProjectID); err != nil {
		if errors.Is(err, services.ErrRegistryProjectNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "registry project not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ident := CurrentIdentity(c)
	owner := ident.Username
	ownerEmail := ident.Email
	if owner == "" {
		owner = ownerEmail
	}
	p, err := h.store.CreateForOwner(req, owner, ownerEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if h.access != nil {
		_ = h.access.EnsureOwner(p.ID, ident)
	}
	if h.envs != nil && h.workspace != nil {
		if _, err := h.envs.EnsureDefault(p, h.workspace); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusCreated, p)
}

func (h *ProjectHandler) UpdateProject(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ServerID != "" {
		if err := h.validateServerID(req.ServerID); err != nil {
			if err == services.ErrServerNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "server not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if req.RegistryProjectID != nil {
		rid := *req.RegistryProjectID
		if err := h.validateRegistryProjectID(rid); err != nil {
			if errors.Is(err, services.ErrRegistryProjectNotFound) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "registry project not found"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if h.access != nil && !h.access.Can(id, CurrentIdentity(c), models.ProjectRoleOwner) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}

	p, err := h.store.Update(id, req)
	if err != nil {
		if err == services.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *ProjectHandler) DeleteProject(c *gin.Context) {
	id := c.Param("id")
	if h.access != nil && !h.access.Can(id, CurrentIdentity(c), models.ProjectRoleOwner) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	if err := h.store.Delete(id); err != nil {
		if err == services.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if h.envs != nil {
		_ = h.envs.DeleteByProject(id)
	}
	if h.resources != nil {
		_ = h.resources.DeleteByProject(id)
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *ProjectHandler) ListMembers(c *gin.Context) {
	projectID := c.Param("id")
	if h.access == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "project access store unavailable"})
		return
	}
	if !h.access.Can(projectID, CurrentIdentity(c), models.ProjectRoleViewer) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	c.JSON(http.StatusOK, h.access.ListMembers(projectID))
}

func (h *ProjectHandler) CreateProjectInvite(c *gin.Context) {
	projectID := c.Param("id")
	if h.access == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "project access store unavailable"})
		return
	}
	if !h.access.Can(projectID, CurrentIdentity(c), models.ProjectRoleOwner) {
		c.JSON(http.StatusForbidden, gin.H{"error": services.ErrProjectAccessDenied.Error()})
		return
	}
	if _, err := h.store.Get(projectID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	var req models.CreateProjectInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	invitedBy := CurrentIdentity(c).Username
	raw, inv, err := h.access.CreateInvite(projectID, req.Email, req.Role, invitedBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	link := publicBaseURL(c) + "/api/projects/invites/accept?token=" + url.QueryEscape(raw)
	resp := gin.H{
		"invite":     inv,
		"inviteLink": link,
	}
	if h.email != nil {
		if err := h.email.SendInvite(inv.Email, link); err != nil {
			resp["emailError"] = err.Error()
		}
	}
	c.JSON(http.StatusOK, resp)
}

func (h *ProjectHandler) AcceptProjectInvite(c *gin.Context) {
	if h.access == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "project access store unavailable"})
		return
	}
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing token"})
		return
	}
	_, _, err := h.access.AcceptInvite(token)
	if err != nil {
		switch err {
		case services.ErrProjectInviteNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
		case services.ErrProjectInviteExpired:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invite expired"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.Redirect(http.StatusFound, publicBaseURL(c)+"/#/login?projectInviteAccepted=1")
}
