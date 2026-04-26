import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit, FolderKanban, Loader2, Plus, Server, Trash2 } from "lucide-react";
import {
  useCreateProject,
  useProjects,
  useRemoveProject,
  useServers,
  useUpdateProject,
} from "@/hooks/useDocker";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Project } from "@/types";

export function Projects() {
  const navigate = useNavigate();
  const { data: projects, isLoading, error, refetch } = useProjects();
  const { data: servers } = useServers();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const removeProject = useRemoveProject();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serverId, setServerId] = useState("local");
  const [formError, setFormError] = useState("");

  const sorted = useMemo(() => {
    return [...(projects ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [projects]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setServerId("local");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setName(project.name);
    setDescription(project.description || "");
    setServerId(project.serverId || "local");
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
    try {
      if (editing) {
        await updateProject.mutateAsync({
          id: editing.id,
          data: {
            name: name.trim(),
            description: description.trim(),
            serverId: serverId || "local",
          },
        });
      } else {
        await createProject.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          serverId: serverId || "local",
        });
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    }
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Xóa project "${project.name}" và metadata AppDock?`)) return;
    await removeProject.mutateAsync(project.id);
  };

  if (error) {
    return (
      <div className="max-w-lg space-y-4 p-8">
        <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
        <p className="text-status-stopped">Không tải được projects: {error.message}</p>
        <Button type="button" variant="secondary" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="mt-1 max-w-2xl text-text-secondary">
            Mỗi project có nhiều environment; resource trong environment có thể deploy bằng Compose, Docker image, hoặc catalog.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tạo project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="Chưa có project"
          description="Tạo project đầu tiên để có environment production và bắt đầu deploy resource."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Tạo project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border border-border bg-background-secondary p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-text-primary">
                    {project.name}
                  </h2>
                  <p className="mt-1 truncate text-xs font-mono text-text-muted">
                    {project.ownerSlug}/{project.slug}-{project.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(project)}
                    aria-label="Sửa project"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-status-stopped hover:text-status-stopped"
                    onClick={() => handleDelete(project)}
                    aria-label="Xóa project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {project.description ? (
                <p className="mt-3 line-clamp-3 text-sm text-text-secondary">
                  {project.description}
                </p>
              ) : null}
              <div className="mt-4 flex items-center gap-2 text-sm text-text-muted">
                <Server className="h-4 w-4" />
                <span className="truncate">
                  {servers?.find((server) => server.id === project.serverId)?.name ??
                    (project.serverId === "local" ? "Local" : project.serverId)}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                Mở environments
              </Button>
            </div>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background-secondary shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {editing ? "Sửa project" : "Tạo project"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {formError ? <p className="text-sm text-status-stopped">{formError}</p> : null}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Tên
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input w-full"
                  placeholder="API production"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Mô tả
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="input w-full resize-none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Docker host
                </span>
                <select
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  className="input w-full"
                >
                  {(servers ?? []).map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                      {server.isLocal ? " (local)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  loading={createProject.isPending || updateProject.isPending}
                >
                  {editing ? "Lưu" : "Tạo"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
