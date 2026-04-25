package models

type CatalogApp struct {
	ID                  string       `json:"id"`
	Name                string       `json:"name"`
	Description         string       `json:"description"`
	Category            string       `json:"category"`
	ResourceType        ResourceType `json:"resourceType"`
	Image               string       `json:"image,omitempty"`
	DefaultServiceName  string       `json:"defaultServiceName"`
	DefaultInternalPort int          `json:"defaultInternalPort,omitempty"`
	HasHTTP             bool         `json:"hasHttp"`
	IsDatabase          bool         `json:"isDatabase"`
	DefaultEnvContent   string       `json:"defaultEnvContent,omitempty"`
}
