import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { ConfigTabsForm } from "@/components/settings/ConfigTabsForm";
import { systemAPI, type ConfigSchemaResponse } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";

export function Settings() {
  const { user } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);

  const adminState: "admin" | "not_admin" | "unknown" =
    user == null ? "admin" : user.isAdmin === true ? "admin" : user.isAdmin === false ? "not_admin" : "unknown";

  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schema, setSchema] = useState<ConfigSchemaResponse | null>(null);
  const [savingTabId, setSavingTabId] = useState<string | null>(null);

  const reload = async () => {
    setSchemaLoading(true);
    try {
      const data = await systemAPI.getConfigSchema();
      setSchema(data);
    } catch (error) {
      addToast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải cấu hình",
        variant: "error",
      });
    } finally {
      setSchemaLoading(false);
    }
  };

  useEffect(() => {
    if (adminState !== "admin") return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminState]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Cài đặt</h1>
        <p className="text-text-secondary mt-1">Quản lý cấu hình ứng dụng (admin-only)</p>
      </div>

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
          <div className="flex justify-between py-2">
            <span className="text-text-muted">Người dùng hiện tại</span>
            <span className="text-text-primary font-medium">{user?.username || "N/A"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-text-muted" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">System configuration</h2>
            <p className="text-sm text-text-muted">
              Admin-only. Secrets are never returned to the browser.
            </p>
          </div>
        </div>

        {adminState === "unknown" ? (
          <div className="bg-background-secondary border border-border rounded-xl p-6 text-sm text-text-muted">
            Đang kiểm tra quyền truy cập...
          </div>
        ) : adminState === "not_admin" ? (
          <div className="bg-background-secondary border border-border rounded-xl p-6 text-sm text-text-muted">
            Bạn không có quyền xem trang này.
          </div>
        ) : !schema && !schemaLoading ? (
          <div className="bg-background-secondary border border-border rounded-xl p-6 text-sm text-text-muted">
            Chưa có dữ liệu cấu hình.
          </div>
        ) : schema ? (
          <ConfigTabsForm
            schema={schema}
            loading={schemaLoading}
            savingTabId={savingTabId}
            onReload={reload}
            onSaveTab={async (tabId, values) => {
              setSavingTabId(tabId);
              try {
                const updated = await systemAPI.patchConfigValues(values);
                setSchema(updated);
                addToast({
                  title: "Thành công",
                  description: "Đã lưu cấu hình",
                  variant: "success",
                });
              } catch (error) {
                addToast({
                  title: "Lỗi",
                  description: error instanceof Error ? error.message : "Không thể lưu cấu hình",
                  variant: "error",
                });
              } finally {
                setSavingTabId(null);
              }
            }}
            onGenerateJWTSecret={async () => {
              try {
                await systemAPI.generateJWTSecret();
                await reload();
                addToast({
                  title: "Thành công",
                  description: "Đã generate JWT secret",
                  variant: "success",
                });
              } catch (error) {
                addToast({
                  title: "Lỗi",
                  description:
                    error instanceof Error ? error.message : "Không thể generate JWT secret",
                  variant: "error",
                });
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
