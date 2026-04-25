package services

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"appdock/internal/models"

	"gopkg.in/yaml.v3"
)

var (
	ErrResourceRenderInvalid = errors.New("invalid resource configuration")
)

type ResourceRenderer struct {
	catalog *CatalogService
}

func NewResourceRenderer(catalog *CatalogService) *ResourceRenderer {
	return &ResourceRenderer{catalog: catalog}
}

func (r *ResourceRenderer) EnvContent(res *models.Resource) string {
	if strings.TrimSpace(res.EnvContent) != "" {
		return res.EnvContent
	}
	if res.Type != models.ResourceTypeCatalog || r.catalog == nil {
		return ""
	}
	app, ok := r.catalog.Get(res.CatalogAppID)
	if !ok {
		return ""
	}
	return app.DefaultEnvContent
}

func (r *ResourceRenderer) Render(project *models.Project, env *models.Environment, res *models.Resource) (string, error) {
	switch res.Type {
	case models.ResourceTypeCompose:
		return r.renderCompose(project, env, res)
	case models.ResourceTypeImage:
		return r.renderImage(project, env, res)
	case models.ResourceTypeCatalog:
		return r.renderCatalog(project, env, res)
	default:
		return "", fmt.Errorf("%w: unsupported resource type %q", ErrResourceRenderInvalid, res.Type)
	}
}

func (r *ResourceRenderer) renderCompose(project *models.Project, env *models.Environment, res *models.Resource) (string, error) {
	if strings.TrimSpace(res.ComposeYAML) == "" {
		return "", fmt.Errorf("%w: compose yaml is empty", ErrResourceRenderInvalid)
	}
	var doc map[string]any
	if err := yaml.Unmarshal([]byte(res.ComposeYAML), &doc); err != nil {
		return "", err
	}
	servicesAny, ok := doc["services"].(map[string]any)
	if !ok || len(servicesAny) == 0 {
		return "", fmt.Errorf("%w: compose services are required", ErrResourceRenderInvalid)
	}
	serviceNames := mapKeys(servicesAny)
	httpService := res.ServiceName
	if httpService == "" && len(serviceNames) == 1 {
		httpService = serviceNames[0]
	}
	for name, raw := range servicesAny {
		serviceMap, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		labels := appdockLabels(project, env, res)
		networks := []string{env.NetworkName}
		if res.HasHTTP && res.Domain != "" && res.InternalPort > 0 && name == httpService {
			labels = append(labels, traefikLabels(res, name)...)
			networks = append(networks, "proxy")
		}
		serviceMap["labels"] = mergeStringList(serviceMap["labels"], labels)
		serviceMap["networks"] = mergeStringList(serviceMap["networks"], networks)
		servicesAny[name] = serviceMap
	}
	doc["services"] = servicesAny
	doc["networks"] = mergeTopNetworks(doc["networks"], env.NetworkName, res.HasHTTP && res.Domain != "")
	out, err := yaml.Marshal(doc)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (r *ResourceRenderer) renderImage(project *models.Project, env *models.Environment, res *models.Resource) (string, error) {
	if strings.TrimSpace(res.Image) == "" {
		return "", fmt.Errorf("%w: image is required", ErrResourceRenderInvalid)
	}
	serviceName := res.ServiceName
	if serviceName == "" {
		serviceName = res.Slug
	}
	service := map[string]any{
		"image":    strings.TrimSpace(res.Image),
		"restart":  "unless-stopped",
		"labels":   appdockLabels(project, env, res),
		"networks": []string{env.NetworkName},
	}
	if strings.TrimSpace(res.Command) != "" {
		service["command"] = strings.TrimSpace(res.Command)
	}
	if strings.TrimSpace(res.EnvContent) != "" {
		service["env_file"] = []string{".env"}
	}
	if len(res.Volumes) > 0 {
		service["volumes"] = cleanStringList(res.Volumes)
	}
	if res.HasHTTP && res.Domain != "" && res.InternalPort > 0 {
		service["labels"] = append(service["labels"].([]string), traefikLabels(res, serviceName)...)
		service["networks"] = []string{env.NetworkName, "proxy"}
	}
	doc := map[string]any{
		"services": map[string]any{serviceName: service},
		"networks": mergeTopNetworks(nil, env.NetworkName, res.HasHTTP && res.Domain != ""),
	}
	out, err := yaml.Marshal(doc)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (r *ResourceRenderer) renderCatalog(project *models.Project, env *models.Environment, res *models.Resource) (string, error) {
	app, ok := r.catalog.Get(res.CatalogAppID)
	if !ok {
		return "", fmt.Errorf("%w: catalog app not found", ErrResourceRenderInvalid)
	}
	if res.ServiceName == "" {
		res.ServiceName = app.DefaultServiceName
	}
	if res.InternalPort == 0 {
		res.InternalPort = app.DefaultInternalPort
	}
	if !res.HasHTTP {
		res.HasHTTP = app.HasHTTP
	}
	if !res.IsDatabase {
		res.IsDatabase = app.IsDatabase
	}
	switch app.ID {
	case "wordpress":
		return r.renderWordPress(project, env, res)
	case "minio":
		return r.renderImageWithDefaults(project, env, res, app, "server /data --console-address :9001", []string{"./data:/data"})
	case "n8n":
		return r.renderImageWithDefaults(project, env, res, app, "", []string{"./data:/home/node/.n8n"})
	case "uptime-kuma":
		return r.renderImageWithDefaults(project, env, res, app, "", []string{"./data:/app/data"})
	case "postgres":
		return r.renderImageWithDefaults(project, env, res, app, "", []string{"./data:/var/lib/postgresql/data"})
	case "mariadb":
		return r.renderImageWithDefaults(project, env, res, app, "", []string{"./data:/var/lib/mysql"})
	default:
		return r.renderImageWithDefaults(project, env, res, app, "", nil)
	}
}

func (r *ResourceRenderer) renderImageWithDefaults(project *models.Project, env *models.Environment, res *models.Resource, app models.CatalogApp, command string, volumes []string) (string, error) {
	clone := *res
	clone.Type = models.ResourceTypeImage
	if clone.Image == "" {
		clone.Image = app.Image
	}
	if clone.ServiceName == "" {
		clone.ServiceName = app.DefaultServiceName
	}
	if clone.InternalPort == 0 {
		clone.InternalPort = app.DefaultInternalPort
	}
	if clone.Command == "" {
		clone.Command = command
	}
	if len(clone.Volumes) == 0 {
		clone.Volumes = volumes
	}
	if strings.TrimSpace(clone.EnvContent) == "" {
		clone.EnvContent = app.DefaultEnvContent
	}
	clone.HasHTTP = app.HasHTTP
	clone.IsDatabase = app.IsDatabase
	return r.renderImage(project, env, &clone)
}

func (r *ResourceRenderer) renderWordPress(project *models.Project, env *models.Environment, res *models.Resource) (string, error) {
	labels := appdockLabels(project, env, res)
	networks := []string{env.NetworkName}
	if res.HasHTTP && res.Domain != "" && res.InternalPort > 0 {
		labels = append(labels, traefikLabels(res, "wordpress")...)
		networks = append(networks, "proxy")
	}
	doc := map[string]any{
		"services": map[string]any{
			"wordpress": map[string]any{
				"image":      "wordpress:latest",
				"restart":    "unless-stopped",
				"depends_on": []string{"db"},
				"environment": map[string]string{
					"WORDPRESS_DB_HOST":     "db:3306",
					"WORDPRESS_DB_NAME":     "wordpress",
					"WORDPRESS_DB_USER":     "wordpress",
					"WORDPRESS_DB_PASSWORD": "wordpress",
				},
				"volumes":  []string{"./wordpress:/var/www/html"},
				"labels":   labels,
				"networks": networks,
			},
			"db": map[string]any{
				"image":   "mariadb:11",
				"restart": "unless-stopped",
				"environment": map[string]string{
					"MYSQL_DATABASE":      "wordpress",
					"MYSQL_USER":          "wordpress",
					"MYSQL_PASSWORD":      "wordpress",
					"MYSQL_ROOT_PASSWORD": "wordpress",
				},
				"volumes":  []string{"./db:/var/lib/mysql"},
				"labels":   appdockLabels(project, env, res),
				"networks": []string{env.NetworkName},
			},
		},
		"networks": mergeTopNetworks(nil, env.NetworkName, res.HasHTTP && res.Domain != ""),
	}
	out, err := yaml.Marshal(doc)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func appdockLabels(project *models.Project, env *models.Environment, res *models.Resource) []string {
	return []string{
		"appdock.project_id=" + project.ID,
		"appdock.environment_id=" + env.ID,
		"appdock.resource_id=" + res.ID,
		"appdock.resource_type=" + string(res.Type),
	}
}

func traefikLabels(res *models.Resource, serviceName string) []string {
	route := "ad-" + ShortID(res.ID) + "-" + strings.ReplaceAll(Identifier(serviceName), "_", "-")
	host := strings.TrimSpace(res.Domain)
	labels := []string{
		"traefik.enable=true",
		"traefik.docker.network=proxy",
		"traefik.http.routers." + route + ".rule=Host(`" + host + "`)",
		"traefik.http.routers." + route + ".service=" + route,
		"traefik.http.services." + route + ".loadbalancer.server.port=" + strconv.Itoa(res.InternalPort),
	}
	if isLocalHTTPDomain(host) {
		return append(labels, "traefik.http.routers."+route+".entrypoints=web")
	}
	return append(labels,
		"traefik.http.routers."+route+".entrypoints=websecure",
		"traefik.http.routers."+route+".tls=true",
		"traefik.http.routers."+route+".tls.certresolver=le",
	)
}

func isLocalHTTPDomain(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimPrefix(host, "https://")
	host = strings.Split(host, "/")[0]
	host = strings.Split(host, ":")[0]
	return host == "localhost" ||
		host == "127.0.0.1" ||
		host == "0.0.0.0" ||
		strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".127.0.0.1.sslip.io")
}

func mergeTopNetworks(existing any, envNetwork string, includeProxy bool) map[string]any {
	out := map[string]any{}
	if m, ok := existing.(map[string]any); ok {
		for k, v := range m {
			out[k] = v
		}
	}
	out[envNetwork] = map[string]any{"external": true}
	if includeProxy {
		out["proxy"] = map[string]any{"external": true}
	}
	return out
}

func mergeStringList(existing any, values []string) []string {
	out := []string{}
	switch v := existing.(type) {
	case []any:
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
	case []string:
		out = append(out, v...)
	case map[string]any:
		for k, val := range v {
			out = append(out, k+"="+fmt.Sprint(val))
		}
	case nil:
	default:
		out = append(out, fmt.Sprint(v))
	}
	return dedupeStrings(append(out, values...))
}

func cleanStringList(values []string) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func dedupeStrings(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func mapKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
