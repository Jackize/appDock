import { useState } from "react";
import { Package, Plus, Trash2, Edit, X, Loader2 } from "lucide-react";
import {
  useRegistryProjects,
  useCreateRegistryProject,
  useUpdateRegistryProject,
  useRemoveRegistryProject,
} from "@/hooks/useDocker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RegistryProject } from "@/types";

export function RegistryProjects() {
  const { data: list, isLoading, error, refetch } = useRegistryProjects();
  const createMut = useCreateRegistryProject();
  const updateMut = useUpdateRegistryProject();
  const removeMut = useRemoveRegistryProject();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RegistryProject | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [host, setHost] = useState("");
  const [namespace, setNamespace] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setHost("");
    setNamespace("");
    setUsername("");
    setPassword("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (r: RegistryProject) => {
    setEditing(r);
    setName(r.name);
    setDescription(r.description);
    setHost(r.host);
    setNamespace(r.namespace);
    setUsername(r.username ?? "");
    setPassword("");
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
    if (!name.trim() || !host.trim()) {
      setFormError("Tên và host là bắt buộc");
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          data: {
            name: name.trim(),
            description: description.trim(),
            host: host.trim(),
            namespace: namespace.trim(),
            username: username.trim(),
            ...(password.trim() ? { password: password.trim() } : {}),
          },
        });
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          host: host.trim(),
          namespace: namespace.trim(),
          username: username.trim(),
          password: password.trim(),
        });
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Lỗi");
    }
  };

  if (error) {
    return (
      <div className="p-8 space-y-4 max-w-lg">
        <h1 className="text-2xl font-bold text-text-primary">Registry projects</h1>
        <p className="text-status-stopped">{error.message}</p>
        <p className="text-sm text-text-muted">
          Cần API <code className="text-xs">/api/registry-projects</code>.
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
          <h1 className="text-2xl font-bold text-text-primary">Registry projects</h1>
          <p className="text-text-secondary mt-1 max-w-2xl">
            Namespace + credentials để pull image (Docker auth). Mật khẩu lưu
            trong file data trên server — chỉ dùng trong môi trường tin cậy.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Thêm registry project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
        </div>
      ) : !list?.length ? (
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="Chưa có registry project"
          description="Thêm Harbor, GHCR, ECR… rồi dùng trên trang Images (pull) hoặc gắn vào AppDock Project."
          action={
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Thêm
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((r) => (
            <Card key={r.id} className="border-border bg-background-secondary/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between gap-2">
                  <span className="truncate">{r.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(r)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-status-stopped"
                      onClick={async () => {
                        if (!confirm(`Xóa "${r.name}"?`)) return;
                        await removeMut.mutateAsync(r.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1 text-text-secondary">
                <p className="font-mono text-xs text-accent break-all">
                  {r.host}/{r.namespace || ""}
                </p>
                {r.username ? (
                  <p>User: {r.username}</p>
                ) : null}
                <p className="text-xs text-text-muted">
                  Password: {r.hasPassword ? "đã lưu" : "chưa"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-background-secondary shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {editing ? "Sửa registry project" : "Registry project mới"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-lg text-text-muted hover:bg-background-hover"
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Registry host
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm font-mono"
                  placeholder="ghcr.io"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Namespace / org
                </label>
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm font-mono"
                  placeholder="myorg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Password / token
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary text-sm"
                  placeholder={editing ? "Để trống nếu giữ nguyên" : ""}
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Hủy
                </Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
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
