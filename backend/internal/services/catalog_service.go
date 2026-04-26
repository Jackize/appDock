package services

import "appdock/internal/models"

type CatalogService struct {
	apps map[string]models.CatalogApp
}

func NewCatalogService() *CatalogService {
	list := []models.CatalogApp{
		{ID: "nginx", Name: "Nginx", Description: "Lightweight web server", Category: "web", ResourceType: models.ResourceTypeCatalog, Image: "nginx:alpine", DefaultServiceName: "web", DefaultInternalPort: 80, HasHTTP: true},
		{ID: "wordpress", Name: "WordPress + MariaDB", Description: "WordPress with a private MariaDB database", Category: "cms", ResourceType: models.ResourceTypeCatalog, DefaultServiceName: "wordpress", DefaultInternalPort: 80, HasHTTP: true},
		{ID: "postgres", Name: "PostgreSQL", Description: "Private PostgreSQL database", Category: "database", ResourceType: models.ResourceTypeCatalog, Image: "postgres:16-alpine", DefaultServiceName: "postgres", IsDatabase: true, DefaultEnvContent: "POSTGRES_DB=appdock\nPOSTGRES_USER=appdock\nPOSTGRES_PASSWORD=appdock"},
		{ID: "mariadb", Name: "MariaDB", Description: "Private MySQL-compatible database", Category: "database", ResourceType: models.ResourceTypeCatalog, Image: "mariadb:11", DefaultServiceName: "mariadb", IsDatabase: true, DefaultEnvContent: "MYSQL_DATABASE=appdock\nMYSQL_USER=appdock\nMYSQL_PASSWORD=appdock\nMYSQL_ROOT_PASSWORD=appdock"},
		{ID: "redis", Name: "Redis", Description: "Private Redis cache", Category: "database", ResourceType: models.ResourceTypeCatalog, Image: "redis:7-alpine", DefaultServiceName: "redis", IsDatabase: true},
		{ID: "n8n", Name: "n8n", Description: "Workflow automation with a web UI", Category: "automation", ResourceType: models.ResourceTypeCatalog, Image: "n8nio/n8n:latest", DefaultServiceName: "n8n", DefaultInternalPort: 5678, HasHTTP: true},
		{ID: "uptime-kuma", Name: "Uptime Kuma", Description: "Self-hosted uptime monitoring", Category: "monitoring", ResourceType: models.ResourceTypeCatalog, Image: "louislam/uptime-kuma:1", DefaultServiceName: "uptime-kuma", DefaultInternalPort: 3001, HasHTTP: true},
		{ID: "pgadmin", Name: "pgAdmin", Description: "PostgreSQL administration web UI", Category: "admin", ResourceType: models.ResourceTypeCatalog, Image: "dpage/pgadmin4:latest", DefaultServiceName: "pgadmin", DefaultInternalPort: 80, HasHTTP: true, DefaultEnvContent: "PGADMIN_DEFAULT_EMAIL=admin@example.com\nPGADMIN_DEFAULT_PASSWORD=appdock"},
		{ID: "minio", Name: "MinIO", Description: "S3-compatible object storage with console UI", Category: "storage", ResourceType: models.ResourceTypeCatalog, Image: "minio/minio:latest", DefaultServiceName: "minio", DefaultInternalPort: 9001, HasHTTP: true, DefaultEnvContent: "MINIO_ROOT_USER=appdock\nMINIO_ROOT_PASSWORD=appdock123"},
	}
	apps := make(map[string]models.CatalogApp, len(list))
	for _, app := range list {
		apps[app.ID] = app
	}
	return &CatalogService{apps: apps}
}

func (s *CatalogService) List() []models.CatalogApp {
	out := make([]models.CatalogApp, 0, len(s.apps))
	for _, app := range s.apps {
		out = append(out, app)
	}
	return out
}

func (s *CatalogService) Get(id string) (models.CatalogApp, bool) {
	app, ok := s.apps[id]
	return app, ok
}
