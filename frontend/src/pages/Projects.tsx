import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  Server,
  Layers,
  X,
  Loader2,
  Rocket,
  Square,
  Package,
} from "lucide-react";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useRemoveProject,
  useServers,
  useRegistryProjects,
  useComposeStacks,
  useCreateComposeStack,
  useUpdateComposeStack,
  useRemoveComposeStack,
  useDeployComposeStack,
  useUndeployComposeStack,
} from "@/hooks/useDocker";
import { useServerStore } from "@/stores/serverStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { ComposeStack, Project } from "@/types";

function parseComposeNames(raw: string): string[] {
  const parts = raw.split(/[\n,]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function Projects() {
  const navigate = useNavigate();
  const { data: projects, isLoading, error, refetch } = useProjects();
  const { data: servers } = useServers();
  const { data: registryProjects } = useRegistryProjects();
  const setCurrentServer = useServerStore((s) => s.setCurrentServer);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const removeProject = useRemoveProject();
  const createStack = useCreateComposeStack();
  const updateStack = useUpdateComposeStack();
  const removeStack = useRemoveComposeStack();
  const deployStack = useDeployComposeStack();
  const undeployStack = useUndeployComposeStack();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serverId, setServerId] = useState("local");
  const [registryProjectId, setRegistryProjectId] = useState("");
  const [composeRaw, setComposeRaw] = useState("");
  const [formError, setFormError] = useState("");

  const [expandedComposePid, setExpandedComposePid] = useState<string | null>(
    null,
  );
  const { data: stacks, refetch: refetchStacks } = useComposeStacks(
    expandedComposePid ?? "",
  );

  const [stackModalOpen, setStackModalOpen] = useState(false);
  const [stackProjectId, setStackProjectId] = useState<string | null>(null);
  const [editingStack, setEditingStack] = useState<ComposeStack | null>(null);
  const [stackName, setStackName] = useState("");
  const [stackComposeProject, setStackComposeProject] = useState("");
  const [stackYaml, setStackYaml] = useState("");
  const [stackEnv, setStackEnv] = useState("");
  const [stackFormError, setStackFormError] = useState("");

  const sorted = useMemo(() => {
    if (!projects?.length) return [];
    return [...projects].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [projects]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setServerId("local");
    setRegistryProjectId("");
    setComposeRaw("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setServerId(p.serverId || "local");
    setRegistryProjectId(p.registryProjectId ?? "");
    setComposeRaw(p.composeProjectNames?.join(", ") ?? "");
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Vui lòng nhập tên project");
      return;
    }
    const composeProjectNames = parseComposeNames(composeRaw);
    try {
      if (editing) {
        await updateProject.mutateAsync({
          id: editing.id,
          data: {
            name: name.trim(),
            description: description.trim(),
            serverId: serverId || "local",
            composeProjectNames,
            registryProjectId:
              registryProjectId === "" ? null : registryProjectId,
          },
        });
      } else {
        await createProject.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          serverId: serverId || "local",
          registryProjectId: registryProjectId || undefined,
          composeProjectNames,
        });
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    }
  };

  const handleDelete = async (p: Project) => {
    if (!confirm(`Xóa project "${p.name}"? Dữ liệu Docker không bị thay đổi.`))
      return;
    await removeProject.mutateAsync(p.id);
  };

  const goToContainers = (p: Project) => {
    setCurrentServer(p.serverId || "local");
    navigate("/containers");
  };

  const openStackCreate = (projectId: string) => {
    setStackProjectId(projectId);
    setEditingStack(null);
    setStackName("");
    setStackComposeProject("");
    setStackYaml(`version: "3.8"
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
`);
    setStackEnv("");
    setStackFormError("");
    setStackModalOpen(true);
  };

  const openStackEdit = (projectId: string, st: ComposeStack) => {
    setStackProjectId(projectId);
    setEditingStack(st);
    setStackName(st.name);
    setStackComposeProject(st.composeProjectName);
    setStackYaml(st.composeYaml);
    setStackEnv(st.envContent ?? "");
    setStackFormError("");
    setStackModalOpen(true);
  };

  const closeStackModal = () => {
    setStackModalOpen(false);
    setStackProjectId(null);
    setEditingStack(null);
    setStackFormError("");
  };

  const handleStackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStackFormError("");
    if (!stackProjectId) return;
    if (!stackName.trim() || !stackComposeProject.trim()) {
      setStackFormError("Tên stack và Compose project name là bắt buộc");
      return;
    }
    if (!stackYaml.trim()) {
      setStackFormError("docker-compose.yml không được để trống");
      return;
    }
    const proj = projects?.find((x) => x.id === stackProjectId);
    const sid = proj?.serverId || "local";
    if (sid !== "local") {
      setStackFormError("Compose deploy chỉ hỗ trợ Docker host Local từ UI này");
      return;
    }
    try {
      if (editingStack) {
        await updateStack.mutateAsync({
          id: editingStack.id,
          projectId: stackProjectId,
          data: {
            name: stackName.trim(),
            composeProjectName: stackComposeProject.trim(),
            composeYaml: stackYaml,
            envContent: stackEnv,
            serverId: "local",
          },
        });
      } else {
        await createStack.mutateAsync({
          projectId: stackProjectId,
          serverId: "local",
          name: stackName.trim(),
          composeProjectName: stackComposeProject.trim(),
          composeYaml: stackYaml,
          envContent: stackEnv,
        });
      }
      closeStackModal();
      refetchStacks();
    } catch (err) {
      setStackFormError(err instanceof Error ? err.message : "Lỗi");
    }
  };

  if (error) {
    return (
      <div className="p-8 space-y-4 max-w-lg">
        <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
        <p className="text-status-stopped">
          Không tải được projects: {error.message}
        </p>
        <p className="text-sm text-text-muted">
          Cần backend hỗ trợ API <code className="text-xs">/api/projects</code>{" "}
          (lưu trong thư mục data). Nếu bạn vừa cập nhật, hãy khởi động lại
          server.
        </p>
        <Button type="button" variant="secondary" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="text-text-secondary mt-1 max-w-2xl">
            Nhóm ứng dụng theo Docker host; gắn registry project để pull có
            auth; triển khai Compose từ YAML trên{" "}
            <strong className="text-text-primary">server local</strong> (chạy{" "}
            <span className="font-mono text-xs">docker compose</span> trên máy
            chạy AppDock).
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Tạo project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-8 h-8" />}
          title="Chưa có project"
          description="Tạo project để theo dõi stack Compose và mở nhanh đúng server trong Containers."
          action={
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Tạo project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => (
            <Card
              key={p.id}
              className="border-border bg-background-secondary/50"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-lg">
                  <span className="truncate">{p.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(p)}
                      aria-label="Sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-status-stopped hover:text-status-stopped"
                      onClick={() => handleDelete(p)}
                      aria-label="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {p.description ? (
                  <p className="text-text-secondary line-clamp-3">{p.description}</p>
                ) : null}
                <div className="flex items-center gap-2 text-text-muted">
                  <Server className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {servers?.find((s) => s.id === p.serverId)?.name ??
                      (p.serverId === "local" ? "Local" : p.serverId)}
                  </span>
                </div>
                {p.registryProjectId ? (
                  <div className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
                    <Package className="w-3.5 h-3.5" />
                    <span className="truncate">
                      Registry:{" "}
                      {registryProjects?.find((r) => r.id === p.registryProjectId)
                        ?.name ?? p.registryProjectId}
                    </span>
                  </div>
                ) : null}
                {p.composeProjectNames?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Layers className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                    {p.composeProjectNames.map((n) => (
                      <span
                        key={n}
                        className="px-2 py-0.5 rounded-md bg-background-hover text-xs font-mono text-text-secondary"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Chưa gắn Compose project</p>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setExpandedComposePid((cur) =>
                        cur === p.id ? null : p.id,
                      )
                    }
                  >
                    <Rocket className="w-4 h-4" />
                    {expandedComposePid === p.id
                      ? "Ẩn Compose stacks"
                      : "Compose stacks (local)"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => goToContainers(p)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Mở Containers
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {expandedComposePid && sorted.length > 0 ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <span className="min-w-0 truncate">
                Compose stacks —{" "}
                {sorted.find((x) => x.id === expandedComposePid)?.name}
              </span>
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => openStackCreate(expandedComposePid)}
                disabled={
                  (projects?.find((x) => x.id === expandedComposePid)
                    ?.serverId ?? "local") !== "local"
                }
              >
                <Plus className="w-4 h-4" />
                Thêm stack
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="-mx-4 overflow-x-auto border-y border-border sm:mx-0 sm:rounded-lg sm:border">
            {!stacks?.length ? (
              <p className="text-sm text-text-muted py-4">
                Chưa có stack. Thêm file compose và bấm Deploy (cần{" "}
                <span className="font-mono">docker compose</span> trên server).
              </p>
            ) : (
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border">
                    <th className="pb-2 pr-4">Tên</th>
                    <th className="pb-2 pr-4">Project (-p)</th>
                    <th className="pb-2 pr-4">Lần deploy</th>
                    <th className="pb-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {stacks.map((st) => (
                    <tr key={st.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{st.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {st.composeProjectName}
                      </td>
                      <td className="py-2 pr-4 text-text-muted text-xs max-w-[200px] truncate">
                        {st.lastDeployAt
                          ? new Date(st.lastDeployAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            deployStack.mutateAsync({
                              id: st.id,
                              projectId: expandedComposePid,
                            })
                          }
                          disabled={deployStack.isPending}
                        >
                          Deploy
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            undeployStack.mutateAsync({
                              id: st.id,
                              projectId: expandedComposePid,
                            })
                          }
                          disabled={undeployStack.isPending}
                        >
                          <Square className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            openStackEdit(expandedComposePid, st)
                          }
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-status-stopped"
                          onClick={async () => {
                            if (!confirm(`Xóa stack "${st.name}"?`)) return;
                            await removeStack.mutateAsync({
                              id: st.id,
                              projectId: expandedComposePid,
                            });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className={cn(
              "w-full max-w-md rounded-xl border border-border bg-background-secondary shadow-xl max-h-[90vh] overflow-y-auto",
            )}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {editing ? "Sửa project" : "Tạo project"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-lg text-text-muted hover:bg-background-hover"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError ? (
                <p className="text-sm text-status-stopped">{formError}</p>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Tên
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm"
                  placeholder="ví dụ: API production"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Mô tả
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm resize-none"
                  placeholder="Ghi chú nội bộ…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Docker host
                </label>
                <select
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm"
                >
                  {(servers ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isLocal ? " (local)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Registry project (tùy chọn)
                </label>
                <select
                  value={registryProjectId}
                  onChange={(e) => setRegistryProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm"
                >
                  <option value="">— Không —</option>
                  {(registryProjects ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.host}/{r.namespace || "(root)"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Compose project names
                </label>
                <textarea
                  value={composeRaw}
                  onChange={(e) => setComposeRaw(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm font-mono resize-none"
                  placeholder="mỗi dòng hoặc dấu phẩy: webapp, worker"
                />
                <p className="text-xs text-text-muted mt-1">
                  Khớp nhãn Docker Compose project trên container.
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createProject.isPending || updateProject.isPending}
                >
                  {(createProject.isPending || updateProject.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {editing ? "Lưu" : "Tạo"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {stackModalOpen && stackProjectId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background-secondary shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingStack ? "Sửa compose stack" : "Compose stack mới"}
              </h2>
              <button
                type="button"
                onClick={closeStackModal}
                className="p-1 rounded-lg text-text-muted hover:bg-background-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStackSubmit} className="p-5 space-y-4">
              {stackFormError ? (
                <p className="text-sm text-status-stopped">{stackFormError}</p>
              ) : null}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    value={stackName}
                    onChange={(e) => setStackName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Compose project name (-p)
                  </label>
                  <input
                    type="text"
                    value={stackComposeProject}
                    onChange={(e) => setStackComposeProject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm font-mono"
                    placeholder="myapp_prod"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  docker-compose.yml
                </label>
                <textarea
                  value={stackYaml}
                  onChange={(e) => setStackYaml(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-xs font-mono resize-y min-h-[200px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  .env (tùy chọn)
                </label>
                <textarea
                  value={stackEnv}
                  onChange={(e) => setStackEnv(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-xs font-mono resize-y"
                  placeholder="KEY=value"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeStackModal}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createStack.isPending || updateStack.isPending
                  }
                >
                  {(createStack.isPending || updateStack.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {editingStack ? "Lưu" : "Tạo"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
