import { useEffect, useState } from "react";
import { Settings as SettingsIcon, User, Lock, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { authAPI } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useAppStore } from "@/stores/appStore";
import { useApplyTraefik, useTraefikLogs, useTraefikStatus } from "@/hooks/useDocker";

export function Settings() {
  const { user, setUsername } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const { data: traefikStatus } = useTraefikStatus();
  const applyTraefik = useApplyTraefik();
  const { data: traefikLogs } = useTraefikLogs("200");
  const [traefikApplyOutput, setTraefikApplyOutput] = useState<string>("");
  const [traefikApplyError, setTraefikApplyError] = useState<string>("");

  const [traefikForm, setTraefikForm] = useState({
    enabled: false,
    domain: "",
    acmeEmail: "",
    cloudflareToken: "",
    dashboardHost: "",
  });

  const [traefikHydrated, setTraefikHydrated] = useState(false);
  useEffect(() => {
    if (!traefikStatus || traefikHydrated) return;
    const cfg = traefikStatus.config;
    setTraefikForm({
      enabled: cfg.enabled,
      domain: cfg.domain || "",
      acmeEmail: cfg.acmeEmail || "",
      cloudflareToken: cfg.cloudflareToken || "",
      dashboardHost: cfg.dashboardHost || "",
    });
    setTraefikHydrated(true);
  }, [traefikStatus, traefikHydrated]);

  useEffect(() => {
    if (!traefikStatus) return;
    const cfg = traefikStatus.config;
    if (cfg.lastApplyOutput) setTraefikApplyOutput(cfg.lastApplyOutput);
    if (cfg.lastApplyError) setTraefikApplyError(cfg.lastApplyError);
  }, [traefikStatus]);

  // Change username form
  const [usernameForm, setUsernameForm] = useState({
    currentPassword: "",
    newUsername: "",
  });
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Change password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameForm.currentPassword || !usernameForm.newUsername) {
      addToast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin",
        variant: "error",
      });
      return;
    }

    if (usernameForm.newUsername.length < 3) {
      addToast({
        title: "Lỗi",
        description: "Username phải có ít nhất 3 ký tự",
        variant: "error",
      });
      return;
    }

    setUsernameLoading(true);
    try {
      const response = await authAPI.changeUsername({
        currentPassword: usernameForm.currentPassword,
        newUsername: usernameForm.newUsername,
      });
      setUsername(response.username);
      addToast({
        title: "Thành công",
        description: "Đã đổi username thành công",
        variant: "success",
      });
      setUsernameForm({ currentPassword: "", newUsername: "" });
    } catch (error) {
      addToast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể đổi username",
        variant: "error",
      });
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      addToast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin",
        variant: "error",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({
        title: "Lỗi",
        description: "Mật khẩu mới không khớp",
        variant: "error",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      addToast({
        title: "Lỗi",
        description: "Mật khẩu mới phải có ít nhất 6 ký tự",
        variant: "error",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      addToast({
        title: "Thành công",
        description: "Đã đổi mật khẩu thành công",
        variant: "success",
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      addToast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể đổi mật khẩu",
        variant: "error",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Cài đặt</h1>
        <p className="text-text-secondary mt-1">
          Quản lý tài khoản và cấu hình ứng dụng
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Change Username Card */}
        <div className="bg-background-secondary border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Đổi Username</h2>
              <p className="text-sm text-text-muted">
                Username hiện tại: <span className="font-medium text-text-secondary">{user?.username || "N/A"}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleChangeUsername} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                value={usernameForm.currentPassword}
                onChange={(e) => setUsernameForm({ ...usernameForm, currentPassword: e.target.value })}
                className="input w-full"
                placeholder="Nhập mật khẩu để xác nhận"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Username mới
              </label>
              <input
                type="text"
                value={usernameForm.newUsername}
                onChange={(e) => setUsernameForm({ ...usernameForm, newUsername: e.target.value })}
                className="input w-full"
                placeholder="Nhập username mới"
              />
            </div>
            <Button
              type="submit"
              loading={usernameLoading}
              disabled={!usernameForm.currentPassword || !usernameForm.newUsername}
              className="w-full"
            >
              <Save className="w-4 h-4" />
              Lưu Username
            </Button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-background-secondary border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-status-paused/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-status-paused" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Đổi Mật khẩu</h2>
              <p className="text-sm text-text-muted">Cập nhật mật khẩu đăng nhập</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="input w-full pr-10"
                  placeholder="Nhập mật khẩu hiện tại"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="input w-full pr-10"
                  placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="input w-full pr-10"
                  placeholder="Nhập lại mật khẩu mới"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-status-stopped mt-1">Mật khẩu không khớp</p>
              )}
            </div>
            <Button
              type="submit"
              loading={passwordLoading}
              disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
              className="w-full"
            >
              <Save className="w-4 h-4" />
              Đổi Mật khẩu
            </Button>
          </form>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-background-secondary border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-text-muted" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Thông tin ứng dụng</h2>
            <p className="text-sm text-text-muted">AppDock - Docker Management UI</p>
          </div>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-muted">Phiên bản</span>
            <span className="text-text-primary font-medium">{__APP_VERSION__}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-muted">Người dùng hiện tại</span>
            <span className="text-text-primary font-medium">{user?.username || "N/A"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-text-muted">GitHub</span>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              github.com/appdock
            </a>
          </div>
        </div>
      </div>

      {/* Traefik (local) */}
      <div className="bg-background-secondary border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Traefik (local)</h2>
            <p className="text-sm text-text-secondary mt-1">
              Bật Traefik để tự động cấp wildcard TLS (DNS-01) và route subdomain cho apps deploy trên local Docker.
            </p>
            <p className="text-xs text-text-muted mt-2">
              Trạng thái: {traefikStatus?.running ? "Running" : "Stopped"} {traefikStatus?.status ? `(${traefikStatus.status})` : ""}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={traefikForm.enabled}
              onChange={(e) => setTraefikForm((p) => ({ ...p, enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Domain</label>
            <input
              className="input w-full"
              placeholder="example.com"
              value={traefikForm.domain}
              onChange={(e) => setTraefikForm((p) => ({ ...p, domain: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">ACME Email</label>
            <input
              className="input w-full"
              placeholder="you@example.com"
              value={traefikForm.acmeEmail}
              onChange={(e) => setTraefikForm((p) => ({ ...p, acmeEmail: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">DNS Provider API Token (DNS Edit)</label>
            <input
              className="input w-full font-mono text-xs"
              placeholder="DNS_API_TOKEN"
              value={traefikForm.cloudflareToken}
              onChange={(e) => setTraefikForm((p) => ({ ...p, cloudflareToken: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Dashboard host (optional)</label>
            <input
              className="input w-full"
              placeholder={`traefik.${traefikForm.domain || "example.com"}`}
              value={traefikForm.dashboardHost}
              onChange={(e) => setTraefikForm((p) => ({ ...p, dashboardHost: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={async () => {
              try {
                setTraefikApplyOutput("");
                setTraefikApplyError("");
                const res = await applyTraefik.mutateAsync({
                  enabled: traefikForm.enabled,
                  domain: traefikForm.domain,
                  acmeEmail: traefikForm.acmeEmail,
                  cloudflareToken: traefikForm.cloudflareToken,
                  dashboardHost: traefikForm.dashboardHost,
                });
                // show backend output directly in UI
                setTraefikApplyOutput((res as { output?: string }).output || "");
              } catch (e) {
                setTraefikApplyError(e instanceof Error ? e.message : "Không thể áp dụng cấu hình");
                addToast({
                  title: "Traefik lỗi",
                  description: e instanceof Error ? e.message : "Không thể áp dụng cấu hình",
                  variant: "error",
                });
              }
            }}
            loading={applyTraefik.isPending}
          >
            <Save className="w-4 h-4" />
            Apply / Reload
          </Button>
        </div>

        <div className="border border-border rounded-lg bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-text-primary">Apply output</p>
            <p className="text-xs text-text-muted">
              {traefikStatus?.config?.lastAppliedAt
                ? new Date(traefikStatus.config.lastAppliedAt).toLocaleString()
                : ""}
            </p>
          </div>
          {traefikApplyError ? (
            <p className="text-xs text-status-stopped whitespace-pre-wrap mb-2">
              {traefikApplyError}
            </p>
          ) : null}
          <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto">
            {traefikApplyOutput || "(no output)"}
          </pre>
        </div>

        <div className="border border-border rounded-lg bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-text-primary">Logs</p>
            <p className="text-xs text-text-muted">tail 200</p>
          </div>
          <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto">
            {traefikLogs?.logs || "(no logs)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
