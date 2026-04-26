import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Database,
  ExternalLink,
  FileCode2,
  Globe,
  Loader2,
  PackagePlus,
  Plus,
  Rocket,
  Save,
  Server,
  Shield,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import {
  useCatalogApps,
  useCreateEnvironment,
  useCreateProjectInvite,
  useCreateResource,
  useDeployResource,
  useEnvironments,
  useProject,
  useProjectMembers,
  useRemoveEnvironment,
  useRemoveResource,
  useResourceConfig,
  useResources,
  useUndeployResource,
  useUpdateResource,
} from "@/hooks/useDocker";
import { Button } from "@/components/ui/Button";
import type { CatalogApp, Resource, ResourceType } from "@/types";

type ResourceTab = "catalog" | "image" | "compose";

function splitLines(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function defaultCompose() {
  return `services:
  web:
    image: nginx:alpine
    restart: unless-stopped
`;
}

function statusClass(status: Resource["status"]) {
  switch (status) {
    case "deployed":
      return "bg-status-running/20 text-status-running";
    case "error":
      return "bg-status-stopped/20 text-status-stopped";
    case "deploying":
      return "bg-status-paused/20 text-status-paused";
    case "stopped":
    case "idle":
      return "bg-status-stopped/20 text-status-stopped";
    default:
      return "bg-background-hover text-text-secondary";
  }
}

function statusLabel(status: Resource["status"]) {
  switch (status) {
    case "deployed":
      return "running";
    case "idle":
    case "stopped":
      return "stopped";
    default:
      return status;
  }
}

function primaryActionLabel(status: Resource["status"], isPending: boolean) {
  const isStopped = status === "stopped" || status === "idle";
  if (isPending) {
    return isStopped ? "Starting" : "Deploying";
  }
  return isStopped ? "Start" : "Deploy";
}

function isLocalDomain(domain?: string) {
  const host = (domain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1.sslip.io")
  );
}

function resourceUrl(resource: Resource) {
  if (!resource.domain) return "";
  return `${isLocalDomain(resource.domain) ? "http" : "https"}://${resource.domain}`;
}

export function ProjectEnvironment() {
  const { projectId = "", environmentId = "" } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: environments, isLoading: envLoading } = useEnvironments(projectId);
  const selectedEnvironment = useMemo(() => {
    if (!environments?.length) return undefined;
    return environments.find((env) => env.id === environmentId) ?? environments[0];
  }, [environmentId, environments]);

  useEffect(() => {
    if (!projectId || !selectedEnvironment) return;
    if (environmentId !== selectedEnvironment.id) {
      navigate(`/projects/${projectId}/environments/${selectedEnvironment.id}`, { replace: true });
    }
  }, [environmentId, navigate, projectId, selectedEnvironment]);

  const { data: resources } = useResources(selectedEnvironment?.id ?? "");
  const { data: members } = useProjectMembers(projectId);
  const { data: catalogApps } = useCatalogApps();
  const createEnvironment = useCreateEnvironment(projectId);
  const removeEnvironment = useRemoveEnvironment(projectId);
  const createResource = useCreateResource(selectedEnvironment?.id ?? "");
  const updateResource = useUpdateResource(selectedEnvironment?.id ?? "");
  const deployResource = useDeployResource(selectedEnvironment?.id ?? "");
  const undeployResource = useUndeployResource(selectedEnvironment?.id ?? "");
  const removeResource = useRemoveResource(selectedEnvironment?.id ?? "");
  const createInvite = useCreateProjectInvite(projectId);

  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [envName, setEnvName] = useState("");
  const [envDescription, setEnvDescription] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"deployer" | "viewer">("viewer");
  const [lastInviteLink, setLastInviteLink] = useState("");

  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [tab, setTab] = useState<ResourceTab>("catalog");
  const [resourceName, setResourceName] = useState("");
  const [description, setDescription] = useState("");
  const [catalogAppId, setCatalogAppId] = useState("");
  const [image, setImage] = useState("");
  const [command, setCommand] = useState("");
  const [volumesRaw, setVolumesRaw] = useState("");
  const [composeYaml, setComposeYaml] = useState(defaultCompose());
  const [envContent, setEnvContent] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [hasHttp, setHasHttp] = useState(true);
  const [domain, setDomain] = useState("");
  const [internalPort, setInternalPort] = useState(80);
  const [isDatabase, setIsDatabase] = useState(false);
  const [formError, setFormError] = useState("");

  const [configResource, setConfigResource] = useState<Resource | null>(null);
  const [hydratedConfigId, setHydratedConfigId] = useState("");
  const {
    data: resourceConfig,
    isFetching: configLoading,
    refetch: refetchResourceConfig,
  } = useResourceConfig(configResource?.id ?? "");
  const [configName, setConfigName] = useState("");
  const [configDescription, setConfigDescription] = useState("");
  const [configType, setConfigType] = useState<ResourceType>("catalog");
  const [configCatalogAppId, setConfigCatalogAppId] = useState("");
  const [configImage, setConfigImage] = useState("");
  const [configCommand, setConfigCommand] = useState("");
  const [configVolumesRaw, setConfigVolumesRaw] = useState("");
  const [configComposeYaml, setConfigComposeYaml] = useState("");
  const [configEnvContent, setConfigEnvContent] = useState("");
  const [configServiceName, setConfigServiceName] = useState("");
  const [configHasHttp, setConfigHasHttp] = useState(false);
  const [configDomain, setConfigDomain] = useState("");
  const [configInternalPort, setConfigInternalPort] = useState(0);
  const [configIsDatabase, setConfigIsDatabase] = useState(false);
  const [configFormError, setConfigFormError] = useState("");

  const selectedCatalog = useMemo(
    () => catalogApps?.find((app) => app.id === catalogAppId),
    [catalogAppId, catalogApps],
  );

  const deployingId = deployResource.isPending ? deployResource.variables : "";
  const undeployingId = undeployResource.isPending ? undeployResource.variables : "";
  const removingId = removeResource.isPending ? removeResource.variables : "";

  useEffect(() => {
    if (!resourceConfig?.resource || hydratedConfigId === resourceConfig.resource.id) {
      return;
    }
    const resource = resourceConfig.resource;
    setConfigName(resource.name);
    setConfigDescription(resource.description || "");
    setConfigType(resource.type);
    setConfigCatalogAppId(resource.catalogAppId || "");
    setConfigImage(resource.image || "");
    setConfigCommand(resource.command || "");
    setConfigVolumesRaw((resource.volumes || []).join("\n"));
    setConfigComposeYaml(resource.composeYaml || resourceConfig.renderedComposeYaml || "");
    setConfigEnvContent(resourceConfig.envContent || resource.envContent || "");
    setConfigServiceName(resource.serviceName || "");
    setConfigHasHttp(resource.hasHttp);
    setConfigDomain(resource.domain || "");
    setConfigInternalPort(resource.internalPort || 0);
    setConfigIsDatabase(resource.isDatabase);
    setConfigFormError("");
    setHydratedConfigId(resource.id);
  }, [hydratedConfigId, resourceConfig]);

  const openResourceModal = (nextTab: ResourceTab) => {
    setTab(nextTab);
    setResourceName("");
    setDescription("");
    setCatalogAppId("");
    setImage("");
    setCommand("");
    setVolumesRaw("");
    setComposeYaml(defaultCompose());
    setEnvContent("");
    setServiceName("");
    setHasHttp(nextTab !== "compose");
    setDomain("");
    setInternalPort(80);
    setIsDatabase(false);
    setFormError("");
    setResourceModalOpen(true);
  };

  const openConfigModal = (resource: Resource) => {
    setConfigResource(resource);
    setHydratedConfigId("");
    setConfigName(resource.name);
    setConfigDescription(resource.description || "");
    setConfigType(resource.type);
    setConfigCatalogAppId(resource.catalogAppId || "");
    setConfigImage(resource.image || "");
    setConfigCommand(resource.command || "");
    setConfigVolumesRaw((resource.volumes || []).join("\n"));
    setConfigComposeYaml(resource.composeYaml || "");
    setConfigEnvContent(resource.envContent || "");
    setConfigServiceName(resource.serviceName || "");
    setConfigHasHttp(resource.hasHttp);
    setConfigDomain(resource.domain || "");
    setConfigInternalPort(resource.internalPort || 0);
    setConfigIsDatabase(resource.isDatabase);
    setConfigFormError("");
  };

  const applyCatalog = (app: CatalogApp) => {
    setCatalogAppId(app.id);
    setResourceName(app.name);
    setDescription(app.description);
    setServiceName(app.defaultServiceName);
    setHasHttp(app.hasHttp);
    setInternalPort(app.defaultInternalPort || 0);
    setIsDatabase(app.isDatabase);
    setEnvContent(app.defaultEnvContent || "");
    if (app.hasHttp) {
      setDomain(`${app.defaultServiceName || app.id}.localhost`);
    } else {
      setDomain("");
    }
  };

  const submitEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!envName.trim()) return;
    const env = await createEnvironment.mutateAsync({
      name: envName.trim(),
      description: envDescription.trim(),
    });
    setEnvModalOpen(false);
    setEnvName("");
    setEnvDescription("");
    navigate(`/projects/${projectId}/environments/${env.id}`);
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const res = await createInvite.mutateAsync({
      email: inviteEmail.trim(),
      role: inviteRole,
    });
    setLastInviteLink(res.inviteLink);
    setInviteEmail("");
  };

  const deleteSelectedEnvironment = async () => {
    if (!selectedEnvironment) return;
    const count = resources?.length ?? 0;
    const running = (resources ?? []).filter((resource) =>
      resource.status === "deployed" || resource.status === "deploying",
    ).length;
    const message =
      count > 0
        ? `Delete environment "${selectedEnvironment.name}"? AppDock will undeploy and remove ${count} resources${running ? ` (${running} running/deploying)` : ""} before deleting the environment.`
        : `Delete environment "${selectedEnvironment.name}"?`;
    if (!confirm(message)) return;

    await removeEnvironment.mutateAsync({
      id: selectedEnvironment.id,
      force: count > 0,
    });

    const next = (environments ?? []).find((env) => env.id !== selectedEnvironment.id);
    if (next) {
      navigate(`/projects/${projectId}/environments/${next.id}`);
    } else {
      navigate("/projects");
    }
  };

  const submitResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!resourceName.trim()) {
      setFormError("Vui lòng nhập tên resource");
      return;
    }
    const type: ResourceType = tab;
    const body = {
      name: resourceName.trim(),
      description: description.trim(),
      type,
      catalogAppId: tab === "catalog" ? catalogAppId : undefined,
      image: tab === "image" ? image.trim() : undefined,
      command: tab === "image" ? command.trim() : undefined,
      volumes: tab === "image" ? splitLines(volumesRaw) : undefined,
      composeYaml: tab === "compose" ? composeYaml : undefined,
      envContent,
      serviceName: serviceName.trim(),
      hasHttp,
      domain: hasHttp ? domain.trim() : undefined,
      internalPort: hasHttp ? Number(internalPort) : undefined,
      isDatabase,
    };
    if (tab === "catalog" && !catalogAppId) {
      setFormError("Vui lòng chọn app trong catalog");
      return;
    }
    if (tab === "image" && !image.trim()) {
      setFormError("Vui lòng nhập Docker image");
      return;
    }
    if (hasHttp && (!internalPort || internalPort < 1)) {
      setFormError("Internal port không hợp lệ");
      return;
    }
    await createResource.mutateAsync(body);
    setResourceModalOpen(false);
  };

  const submitResourceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configResource) return;
    setConfigFormError("");
    if (!configName.trim()) {
      setConfigFormError("Vui lòng nhập tên resource");
      return;
    }
    if (configType === "catalog" && !configCatalogAppId.trim()) {
      setConfigFormError("Vui lòng chọn catalog app");
      return;
    }
    if (configType === "image" && !configImage.trim()) {
      setConfigFormError("Vui lòng nhập Docker image");
      return;
    }
    if (configType === "compose" && !configComposeYaml.trim()) {
      setConfigFormError("docker-compose.yml không được để trống");
      return;
    }
    if (configHasHttp && (!configInternalPort || configInternalPort < 1)) {
      setConfigFormError("Internal port không hợp lệ");
      return;
    }
    await updateResource.mutateAsync({
      id: configResource.id,
      data: {
        name: configName.trim(),
        description: configDescription.trim(),
        type: configType,
        catalogAppId: configType === "catalog" ? configCatalogAppId.trim() : "",
        image: configType === "image" ? configImage.trim() : "",
        command: configType === "image" ? configCommand.trim() : "",
        volumes: configType === "image" ? splitLines(configVolumesRaw) : [],
        composeYaml: configType === "compose" ? configComposeYaml : "",
        envContent: configEnvContent,
        serviceName: configServiceName.trim(),
        hasHttp: configHasHttp,
        domain: configHasHttp ? configDomain.trim() : "",
        internalPort: configHasHttp ? Number(configInternalPort) : 0,
        isDatabase: configIsDatabase,
      },
    });
    setHydratedConfigId("");
    await refetchResourceConfig();
  };

  if (projectLoading || envLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    );
  }

  if (!project) {
    return <p className="p-8 text-status-stopped">Project không tồn tại hoặc bạn không có quyền.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            className="mb-2 text-sm text-text-muted hover:text-text-primary"
            onClick={() => navigate("/projects")}
          >
            ← Projects
          </button>
          <h1 className="truncate text-2xl font-bold text-text-primary">{project.name}</h1>
          <p className="mt-1 text-sm font-mono text-text-muted">
            {project.ownerSlug}/{project.slug}-{project.id.slice(0, 8)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => setEnvModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Environment
          </Button>
          <Button onClick={() => openResourceModal("catalog")} disabled={!selectedEnvironment}>
            <PackagePlus className="h-4 w-4" />
            Add resource
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {(environments ?? []).map((env) => (
          <button
            key={env.id}
            type="button"
            className={[
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
              selectedEnvironment?.id === env.id
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:bg-background-hover",
            ].join(" ")}
            onClick={() => navigate(`/projects/${project.id}/environments/${env.id}`)}
          >
            {env.name}
          </button>
        ))}
      </div>

      {selectedEnvironment ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background-secondary p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    {selectedEnvironment.name}
                  </h2>
                  <p className="mt-1 text-xs font-mono text-text-muted">
                    {selectedEnvironment.networkName}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Server className="h-4 w-4" />
                  {selectedEnvironment.serverId === "local" ? "Local" : selectedEnvironment.serverId}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={deleteSelectedEnvironment}
                  loading={removeEnvironment.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete environment
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background-secondary">
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-text-primary">Resources</h2>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openResourceModal("compose")}>
                    Compose
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openResourceModal("image")}>
                    Image
                  </Button>
                  <Button size="sm" onClick={() => openResourceModal("catalog")}>
                    Catalog
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {!resources?.length ? (
                  <p className="p-5 text-sm text-text-muted">Chưa có resource trong environment này.</p>
                ) : (
                  resources.map((resource) => {
                    const isDeployed = resource.status === "deployed";
                    const isDeploying = resource.status === "deploying" || deployingId === resource.id;
                    const primaryLabel = primaryActionLabel(resource.status, isDeploying);

                    return (
                      <div key={resource.id} className="p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-text-primary">{resource.name}</h3>
                              <span className={`rounded px-2 py-0.5 text-xs ${statusClass(resource.status)}`}>
                                {statusLabel(resource.status)}
                              </span>
                              <span className="rounded bg-background-hover px-2 py-0.5 text-xs text-text-secondary">
                                {resource.type}
                              </span>
                              {resource.isDatabase ? (
                                <span className="inline-flex items-center gap-1 rounded bg-background-hover px-2 py-0.5 text-xs text-text-muted">
                                  <Database className="h-3 w-3" />
                                  private
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs font-mono text-text-muted">
                              {resource.composeProjectName}
                            </p>
                            {resource.domain ? (
                              <a
                                className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
                                href={resourceUrl(resource)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Globe className="h-4 w-4" />
                                {resource.domain}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : resource.isDatabase ? (
                              <p className="mt-2 text-sm text-text-muted">
                                Dùng host nội bộ <span className="font-mono">{resource.serviceName || resource.slug}</span> trong cùng environment network.
                              </p>
                            ) : null}
                            {resource.lastDeployError ? (
                              <p className="mt-2 text-xs text-status-stopped">{resource.lastDeployError}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openConfigModal(resource)}
                            >
                              <FileCode2 className="h-4 w-4" />
                              Config
                            </Button>
                            <Button
                              size="sm"
                              variant={isDeployed ? "success" : "primary"}
                              className="min-w-[96px]"
                              onClick={() => deployResource.mutate(resource.id)}
                              loading={deployingId === resource.id}
                              disabled={!!deployingId || !!undeployingId}
                            >
                              <Rocket className="h-4 w-4" />
                              {primaryLabel}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="min-w-[84px]"
                              onClick={() => undeployResource.mutate(resource.id)}
                              loading={undeployingId === resource.id}
                              disabled={!!deployingId || !!undeployingId || !isDeployed}
                            >
                              <Square className="h-3 w-3" />
                              Stop
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                if (confirm(`Xóa resource "${resource.name}"?`)) {
                                  removeResource.mutate(resource.id);
                                }
                              }}
                              loading={removingId === resource.id}
                              disabled={!!removingId}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background-secondary p-4">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-text-primary">Members</h2>
              </div>
              <form onSubmit={submitInvite} className="space-y-3">
                <input
                  className="input w-full"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select
                  className="input w-full"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "deployer" | "viewer")}
                >
                  <option value="viewer">Viewer</option>
                  <option value="deployer">Deployer</option>
                </select>
                <Button className="w-full" loading={createInvite.isPending}>
                  Invite
                </Button>
              </form>
              {lastInviteLink ? (
                <p className="mt-3 break-all rounded bg-background p-2 text-xs text-text-muted">
                  {lastInviteLink}
                </p>
              ) : null}
              <div className="mt-4 space-y-2">
                {(members ?? []).map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-text-secondary">
                      {member.email || member.username}
                    </span>
                    <span className="shrink-0 rounded bg-background-hover px-2 py-0.5 text-xs text-text-muted">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background-secondary p-4">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-text-muted" />
                <h2 className="font-semibold text-text-primary">Database policy</h2>
              </div>
              <p className="text-sm text-text-muted">
                Databases stay private. In pgAdmin, connect to PostgreSQL with host <span className="font-mono text-text-secondary">postgres</span>, port <span className="font-mono text-text-secondary">5432</span>, using the database credentials from the resource env.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-text-muted">Project này chưa có environment.</p>
      )}

      {envModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={submitEnvironment}
            className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background-secondary p-5"
          >
            <h2 className="text-lg font-semibold text-text-primary">Environment mới</h2>
            <input
              className="input w-full"
              placeholder="staging"
              value={envName}
              onChange={(e) => setEnvName(e.target.value)}
            />
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Mô tả"
              value={envDescription}
              onChange={(e) => setEnvDescription(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEnvModalOpen(false)}>
                Hủy
              </Button>
              <Button loading={createEnvironment.isPending}>Tạo</Button>
            </div>
          </form>
        </div>
      ) : null}

      {configResource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={submitResourceConfig}
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-background-secondary"
          >
            <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Resource config</h2>
                <p className="text-xs font-mono text-text-muted">{configResource.composeProjectName}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConfigResource(null);
                  setHydratedConfigId("");
                }}
              >
                Đóng
              </Button>
            </div>
            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                {configFormError ? (
                  <p className="text-sm text-status-stopped">{configFormError}</p>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Tên</span>
                    <input
                      className="input w-full"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Type</span>
                    <select
                      className="input w-full"
                      value={configType}
                      onChange={(e) => setConfigType(e.target.value as ResourceType)}
                    >
                      <option value="catalog">catalog</option>
                      <option value="image">image</option>
                      <option value="compose">compose</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-text-secondary">Mô tả</span>
                  <input
                    className="input w-full"
                    value={configDescription}
                    onChange={(e) => setConfigDescription(e.target.value)}
                  />
                </label>

                {configType === "catalog" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Catalog app</span>
                    <select
                      className="input w-full"
                      value={configCatalogAppId}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfigCatalogAppId(next);
                        const app = catalogApps?.find((item) => item.id === next);
                        if (app) {
                          setConfigServiceName(app.defaultServiceName);
                          setConfigHasHttp(app.hasHttp);
                          setConfigInternalPort(app.defaultInternalPort || 0);
                          setConfigIsDatabase(app.isDatabase);
                          if (!configEnvContent.trim()) {
                            setConfigEnvContent(app.defaultEnvContent || "");
                          }
                        }
                      }}
                    >
                      <option value="">Chọn app...</option>
                      {(catalogApps ?? []).map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {configType === "image" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-text-secondary">Image</span>
                      <input
                        className="input w-full font-mono"
                        value={configImage}
                        onChange={(e) => setConfigImage(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-text-secondary">Command</span>
                      <input
                        className="input w-full font-mono"
                        value={configCommand}
                        onChange={(e) => setConfigCommand(e.target.value)}
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-text-secondary">Volumes</span>
                      <textarea
                        className="input w-full font-mono text-xs"
                        rows={3}
                        value={configVolumesRaw}
                        onChange={(e) => setConfigVolumesRaw(e.target.value)}
                      />
                    </label>
                  </div>
                ) : null}

                {configType === "compose" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">docker-compose.yml</span>
                    <textarea
                      className="input w-full font-mono text-xs"
                      rows={10}
                      value={configComposeYaml}
                      onChange={(e) => setConfigComposeYaml(e.target.value)}
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-text-secondary">.env</span>
                  <textarea
                    className="input w-full font-mono text-xs"
                    rows={4}
                    value={configEnvContent}
                    onChange={(e) => setConfigEnvContent(e.target.value)}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Service</span>
                    <input
                      className="input w-full font-mono"
                      value={configServiceName}
                      onChange={(e) => setConfigServiceName(e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={configHasHttp}
                      disabled={configIsDatabase}
                      onChange={(e) => setConfigHasHttp(e.target.checked)}
                    />
                    HTTP UI
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={configIsDatabase}
                      onChange={(e) => {
                        setConfigIsDatabase(e.target.checked);
                        if (e.target.checked) setConfigHasHttp(false);
                      }}
                    />
                    Database/private
                  </label>
                </div>

                {configHasHttp ? (
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-text-secondary">Domain</span>
                      <input
                        className="input w-full"
                        value={configDomain}
                        onChange={(e) => setConfigDomain(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-text-secondary">Port</span>
                      <input
                        className="input w-full"
                        type="number"
                        min={1}
                        value={configInternalPort || ""}
                        onChange={(e) => setConfigInternalPort(Number(e.target.value))}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary">Rendered compose</p>
                    {configLoading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : null}
                  </div>
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-text-secondary">
                    {resourceConfig?.renderedComposeYaml || "(no compose)"}
                  </pre>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="mb-2 text-sm font-medium text-text-primary">Work dir</p>
                  <p className="break-all font-mono text-xs text-text-muted">
                    {resourceConfig?.workDir || configResource.workDir}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConfigResource(null);
                  setHydratedConfigId("");
                }}
              >
                Hủy
              </Button>
              <Button loading={updateResource.isPending}>
                <Save className="h-4 w-4" />
                Save config
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {resourceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={submitResource}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-background-secondary"
          >
            <div className="border-b border-border p-5">
              <h2 className="text-lg font-semibold text-text-primary">Add resource</h2>
            </div>
            <div className="space-y-5 p-5">
              {formError ? <p className="text-sm text-status-stopped">{formError}</p> : null}
              <div className="flex gap-2">
                {(["catalog", "image", "compose"] as ResourceTab[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={[
                      "rounded-lg px-3 py-2 text-sm font-medium",
                      tab === item ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-background-hover",
                    ].join(" ")}
                    onClick={() => setTab(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {tab === "catalog" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(catalogApps ?? []).map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className={[
                        "rounded-lg border p-3 text-left",
                        catalogAppId === app.id
                          ? "border-accent bg-accent/10"
                          : "border-border bg-background hover:border-accent/50",
                      ].join(" ")}
                      onClick={() => applyCatalog(app)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-text-primary">{app.name}</span>
                        {app.isDatabase ? <Database className="h-4 w-4 text-text-muted" /> : <Globe className="h-4 w-4 text-accent" />}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-text-muted">{app.description}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-text-secondary">Tên</span>
                  <input className="input w-full" value={resourceName} onChange={(e) => setResourceName(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-text-secondary">Service name</span>
                  <input className="input w-full font-mono" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder={selectedCatalog?.defaultServiceName || "web"} />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-text-secondary">Mô tả</span>
                <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>

              {tab === "image" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Image</span>
                    <input className="input w-full font-mono" value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx:alpine" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Command</span>
                    <input className="input w-full font-mono" value={command} onChange={(e) => setCommand(e.target.value)} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Volumes, one per line</span>
                    <textarea className="input w-full font-mono text-xs" rows={3} value={volumesRaw} onChange={(e) => setVolumesRaw(e.target.value)} placeholder="./data:/data" />
                  </label>
                </div>
              ) : null}

              {tab === "compose" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-text-secondary">docker-compose.yml</span>
                  <textarea className="input w-full font-mono text-xs" rows={12} value={composeYaml} onChange={(e) => setComposeYaml(e.target.value)} />
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-text-secondary">.env</span>
                <textarea className="input w-full font-mono text-xs" rows={4} value={envContent} onChange={(e) => setEnvContent(e.target.value)} />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={hasHttp} onChange={(e) => setHasHttp(e.target.checked)} disabled={isDatabase} />
                  HTTP UI
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={isDatabase} onChange={(e) => {
                    setIsDatabase(e.target.checked);
                    if (e.target.checked) setHasHttp(false);
                  }} />
                  Database/private
                </label>
                {hasHttp ? (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-text-secondary">Internal port</span>
                    <input className="input w-full" type="number" min={1} value={internalPort || ""} onChange={(e) => setInternalPort(Number(e.target.value))} />
                  </label>
                ) : null}
              </div>
              {hasHttp ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-text-secondary">Domain</span>
                  <input className="input w-full" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="pgadmin.localhost" />
                  <p className="mt-1 text-xs text-text-muted">
                    Local dev: use a unique host like <span className="font-mono">pgadmin.localhost</span>. Production: use a real DNS name.
                  </p>
                </label>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setResourceModalOpen(false)}>
                Hủy
              </Button>
              <Button loading={createResource.isPending}>Tạo resource</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
