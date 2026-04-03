import { useState } from "react";
import {
  Server,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Wifi,
  WifiOff,
  Monitor,
  X,
  Loader2,
  Star,
  ExternalLink,
} from "lucide-react";
import { useServers, useCreateServer, useUpdateServer, useRemoveServer, useTestServerConnection } from "@/hooks/useDocker";
import { useServerStore } from "@/stores/serverStore";
import { cn } from "@/lib/utils";
import type { Server as ServerType, CreateServerRequest, UpdateServerRequest } from "@/types";

export default function Servers() {
  const { data: servers, isLoading, refetch } = useServers();
  const createServer = useCreateServer();
  const updateServer = useUpdateServer();
  const removeServer = useRemoveServer();
  const testConnection = useTestServerConnection();
  const { currentServerId, setCurrentServer } = useServerStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerType | null>(null);
  const [formData, setFormData] = useState<CreateServerRequest>({
    name: "",
    host: "",
    apiKey: "",
  });
  const [formError, setFormError] = useState("");

  const handleOpenAdd = () => {
    setFormData({ name: "", host: "", apiKey: "" });
    setFormError("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (server: ServerType) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      host: server.host,
      apiKey: "",
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("Vui lòng nhập tên server");
      return;
    }
    if (!formData.host.trim()) {
      setFormError("Vui lòng nhập địa chỉ server");
      return;
    }
    if (!formData.apiKey.trim()) {
      setFormError("Vui lòng nhập API key");
      return;
    }

    try {
      await createServer.mutateAsync(formData);
      setShowAddModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;
    setFormError("");

    const updateData: UpdateServerRequest = {};
    if (formData.name.trim() && formData.name !== editingServer.name) {
      updateData.name = formData.name;
    }
    if (formData.host.trim() && formData.host !== editingServer.host) {
      updateData.host = formData.host;
    }
    if (formData.apiKey.trim()) {
      updateData.apiKey = formData.apiKey;
    }

    if (Object.keys(updateData).length === 0) {
      setShowEditModal(false);
      return;
    }

    try {
      await updateServer.mutateAsync({ id: editingServer.id, data: updateData });
      setShowEditModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa server này?")) return;
    await removeServer.mutateAsync(id);
  };

  const handleTestConnection = async (id: string) => {
    await testConnection.mutateAsync(id);
  };

  const handleSetDefault = async (server: ServerType) => {
    await updateServer.mutateAsync({
      id: server.id,
      data: { isDefault: true },
    });
  };

  const handleSelectServer = (id: string) => {
    setCurrentServer(id);
  };

  const getStatusBadge = (status: string, isLocal: boolean) => {
    if (isLocal) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
          <Monitor className="w-3 h-3" />
          Local
        </span>
      );
    }
    if (status === "online") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-running/10 text-status-running text-xs font-medium">
          <Wifi className="w-3 h-3" />
          Online
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-stopped/10 text-status-stopped text-xs font-medium">
        <WifiOff className="w-3 h-3" />
        Offline
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Server className="w-7 h-7 text-accent" />
            Quản lý Server
          </h1>
          <p className="text-text-muted mt-1">
            Quản lý các server từ xa và kết nối agent
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Làm mới
          </button>
          <button
            onClick={handleOpenAdd}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Thêm Server
          </button>
        </div>
      </div>

      {/* Server list */}
      <div className="grid gap-4">
        {servers?.map((server) => (
          <div
            key={server.id}
            className={cn(
              "p-4 rounded-xl bg-background-secondary border transition-colors",
              server.id === currentServerId
                ? "border-accent"
                : "border-border hover:border-border-hover"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    server.isLocal
                      ? "bg-accent/10"
                      : server.status === "online"
                      ? "bg-status-running/10"
                      : "bg-status-stopped/10"
                  )}
                >
                  {server.isLocal ? (
                    <Monitor className="w-6 h-6 text-accent" />
                  ) : (
                    <Server
                      className={cn(
                        "w-6 h-6",
                        server.status === "online"
                          ? "text-status-running"
                          : "text-status-stopped"
                      )}
                    />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-text-primary">
                      {server.name}
                    </h3>
                    {getStatusBadge(server.status, server.isLocal)}
                    {server.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium">
                        <Star className="w-3 h-3" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted mt-0.5">
                    {server.isLocal ? "Máy chủ cục bộ" : server.host}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {server.id !== currentServerId && (
                  <button
                    onClick={() => handleSelectServer(server.id)}
                    className="btn-secondary text-sm px-3 py-1.5"
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Chọn
                  </button>
                )}
                {!server.isLocal && (
                  <>
                    <button
                      onClick={() => handleTestConnection(server.id)}
                      disabled={testConnection.isPending}
                      className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-background-hover transition-colors"
                      title="Test kết nối"
                    >
                      <RefreshCw
                        className={cn(
                          "w-4 h-4",
                          testConnection.isPending && "animate-spin"
                        )}
                      />
                    </button>
                    {!server.isDefault && (
                      <button
                        onClick={() => handleSetDefault(server)}
                        className="p-2 rounded-lg text-text-secondary hover:text-yellow-500 hover:bg-background-hover transition-colors"
                        title="Đặt làm mặc định"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(server)}
                      className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-background-hover transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(server.id)}
                      className="p-2 rounded-lg text-text-secondary hover:text-status-stopped hover:bg-background-hover transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {(!servers || servers.length === 0) && !isLoading && (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted">Chưa có server nào được cấu hình</p>
            <button
              onClick={handleOpenAdd}
              className="btn-primary mt-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm Server đầu tiên
            </button>
          </div>
        )}
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-secondary rounded-xl border border-border w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Thêm Server mới
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-status-stopped/10 border border-status-stopped/20 text-sm text-status-stopped">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Tên server
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="VD: Production Server"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Địa chỉ Agent
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, host: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="VD: http://192.168.1.100:9090"
                  required
                />
                <p className="text-xs text-text-muted mt-1">
                  Địa chỉ URL của AppDock Agent (bao gồm protocol và port)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="API key của Agent"
                  required
                />
                <p className="text-xs text-text-muted mt-1">
                  API key được cấu hình trên Agent (AGENT_API_KEY)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createServer.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {createServer.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang thêm...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Thêm Server
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Server Modal */}
      {showEditModal && editingServer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-secondary rounded-xl border border-border w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Chỉnh sửa Server
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-status-stopped/10 border border-status-stopped/20 text-sm text-status-stopped">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Tên server
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="VD: Production Server"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Địa chỉ Agent
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, host: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="VD: http://192.168.1.100:9090"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  API Key mới (để trống nếu không đổi)
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="Nhập API key mới"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary flex-1"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updateServer.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {updateServer.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu thay đổi"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
