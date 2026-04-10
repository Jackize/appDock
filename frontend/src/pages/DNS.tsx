import { Button } from "@/components/ui/Button";
import { dnsAPI } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import type {
  CloudflareCreateDNSRecordRequest,
  CloudflareDNSRecord,
  CloudflareZone,
} from "@/types";
import { Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CF_AUTH_KEY = "appdock.cloudflareAuth";

type CloudflareAuthUI = {
  // Recommended
  token: string;
  // Alternative
  email: string;
  apiKey: string;
};

function cloudflareAuthParams(auth: CloudflareAuthUI): {
  token?: string;
  email?: string;
  apiKey?: string;
} {
  if (auth.token) {
    return { token: auth.token };
  }
  return {
    email: auth.email || undefined,
    apiKey: auth.apiKey || undefined,
  };
}

export function DNS() {
  const addToast = useAppStore((s) => s.addToast);

  // Store Cloudflare credentials in sessionStorage instead of localStorage for improved security.
  const [auth, setAuth] = useState<CloudflareAuthUI>(() => {
    try {
      const raw = sessionStorage.getItem(CF_AUTH_KEY);
      if (!raw) return { token: "", email: "", apiKey: "" };
      const parsed = JSON.parse(raw) as Partial<CloudflareAuthUI>;
      return {
        token: parsed.token || "",
        email: parsed.email || "",
        apiKey: parsed.apiKey || "",
      };
    } catch {
      return { token: "", email: "", apiKey: "" };
    }
  });

  // Persist updates to auth in sessionStorage for this tab only
  useEffect(() => {
    sessionStorage.setItem(CF_AUTH_KEY, JSON.stringify(auth));
  }, [auth]);

  // Remove legacy duplicate storage (was also written to localStorage)
  useEffect(() => {
    try {
      localStorage.removeItem(CF_AUTH_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const [zoneQuery, setZoneQuery] = useState("");
  const [zones, setZones] = useState<CloudflareZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  const [records, setRecords] = useState<CloudflareDNSRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId),
    [zones, selectedZoneId],
  );

  const [newRecord, setNewRecord] = useState<CloudflareCreateDNSRecordRequest>({
    type: "A",
    name: "",
    content: "",
    ttl: 1,
    proxied: false,
  });

  const canAuth = Boolean(auth.token || (auth.email && auth.apiKey));

  const verify = async () => {
    try {
      await dnsAPI.cloudflare.verify(cloudflareAuthParams(auth));
      addToast({
        title: "Thành công",
        description: "Xác thực Cloudflare thành công",
        variant: "success",
      });
    } catch (e) {
      addToast({
        title: "Lỗi",
        description:
          e instanceof Error ? e.message : "Không thể xác thực Cloudflare",
        variant: "error",
      });
    }
  };

  const loadZones = async () => {
    setZonesLoading(true);
    try {
      const z = await dnsAPI.cloudflare.listZones({
        ...cloudflareAuthParams(auth),
        name: zoneQuery || undefined,
      });
      setZones(z);
      if (z.length === 1) setSelectedZoneId(z[0].id);
    } catch (e) {
      addToast({
        title: "Lỗi",
        description: e instanceof Error ? e.message : "Không thể tải zones",
        variant: "error",
      });
    } finally {
      setZonesLoading(false);
    }
  };

  const loadRecords = async () => {
    if (!selectedZoneId) return;
    setRecordsLoading(true);
    try {
      const r = await dnsAPI.cloudflare.listRecords({
        ...cloudflareAuthParams(auth),
        zoneId: selectedZoneId,
      });
      setRecords(r);
    } catch (e) {
      addToast({
        title: "Lỗi",
        description:
          e instanceof Error ? e.message : "Không thể tải DNS records",
        variant: "error",
      });
    } finally {
      setRecordsLoading(false);
    }
  };

  const createRecord = async () => {
    if (!selectedZoneId) return;
    if (!newRecord.name || !newRecord.content || !newRecord.type) {
      addToast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ: type, name, content",
        variant: "error",
      });
      return;
    }
    try {
      await dnsAPI.cloudflare.createRecord({
        ...cloudflareAuthParams(auth),
        zoneId: selectedZoneId,
        data: newRecord,
      });
      addToast({
        title: "Thành công",
        description: "Đã tạo DNS record",
        variant: "success",
      });
      setNewRecord({
        type: "A",
        name: "",
        content: "",
        ttl: 1,
        proxied: false,
      });
      await loadRecords();
    } catch (e) {
      addToast({
        title: "Lỗi",
        description: e instanceof Error ? e.message : "Không thể tạo record",
        variant: "error",
      });
    }
  };

  const deleteRecord = async (recordId: string) => {
    if (!selectedZoneId) return;
    try {
      await dnsAPI.cloudflare.deleteRecord({
        ...cloudflareAuthParams(auth),
        zoneId: selectedZoneId,
        recordId,
      });
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      addToast({
        title: "Thành công",
        description: "Đã xóa DNS record",
        variant: "success",
      });
    } catch (e) {
      addToast({
        title: "Lỗi",
        description: e instanceof Error ? e.message : "Không thể xóa record",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">DNS Manager</h1>
        <p className="text-text-secondary mt-1">
          Quản lý DNS records qua Cloudflare (API Token hoặc Global API Key +
          Email)
        </p>
      </div>

      <div className="bg-background-secondary border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-text-primary">
              Cloudflare
            </div>
            <div className="text-sm text-text-muted">
              Khuyến nghị: API Token (Zone:Read, DNS:Edit). Hoặc dùng Global API
              Key + Email.
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              API Token
            </label>
            <input
              type="password"
              value={auth.token}
              onChange={(e) =>
                setAuth((p) => ({ ...p, token: e.target.value }))
              }
              className="input w-full"
              placeholder="Recommended: Cloudflare API Token"
            />
            <p className="text-xs text-text-muted mt-1">
              Nếu dùng token, bạn không cần email/api key.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Email
            </label>
            <input
              value={auth.email}
              onChange={(e) =>
                setAuth((p) => ({ ...p, email: e.target.value }))
              }
              className="input w-full"
              placeholder="Cloudflare account email (for Global API Key)"
              disabled={!!auth.token}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Global API Key
            </label>
            <input
              type="password"
              value={auth.apiKey}
              onChange={(e) =>
                setAuth((p) => ({ ...p, apiKey: e.target.value }))
              }
              className="input w-full"
              placeholder="Cloudflare Global API Key"
              disabled={!!auth.token}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={verify} disabled={!canAuth}>
            Xác thực
          </Button>
          <Button
            onClick={loadZones}
            loading={zonesLoading}
            disabled={!canAuth}
          >
            <RefreshCw className="w-4 h-4" />
            Tải zones
          </Button>
          <div className="flex-1 min-w-[240px]">
            <input
              value={zoneQuery}
              onChange={(e) => setZoneQuery(e.target.value)}
              className="input w-full"
              placeholder="Filter zone by name (optional) e.g. example.com"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Zone
            </label>
            <select
              className="input w-full"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
            >
              <option value="">-- Chọn zone --</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.id.slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button
              onClick={loadRecords}
              loading={recordsLoading}
              disabled={!canAuth || !selectedZoneId}
            >
              <RefreshCw className="w-4 h-4" />
              Tải records
            </Button>
            <div className="text-sm text-text-muted">
              {selectedZone ? `Zone: ${selectedZone.name}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-background-secondary border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Tạo DNS record
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Type
            </label>
            <select
              className="input w-full"
              value={newRecord.type}
              onChange={(e) =>
                setNewRecord((p) => ({ ...p, type: e.target.value }))
              }
            >
              {["A", "AAAA", "CNAME", "TXT", "MX", "NS", "SRV"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-primary mb-1">
              Name
            </label>
            <input
              className="input w-full"
              value={newRecord.name}
              onChange={(e) =>
                setNewRecord((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="sub.example.com"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-primary mb-1">
              Content
            </label>
            <input
              className="input w-full"
              value={newRecord.content}
              onChange={(e) =>
                setNewRecord((p) => ({ ...p, content: e.target.value }))
              }
              placeholder="1.2.3.4 / target.example.com / value"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              TTL
            </label>
            <input
              className="input w-full"
              type="number"
              min={1}
              value={newRecord.ttl ?? 1}
              onChange={(e) =>
                setNewRecord((p) => ({ ...p, ttl: Number(e.target.value) }))
              }
            />
            <p className="text-xs text-text-muted mt-1">TTL=1 nghĩa là Auto</p>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={!!newRecord.proxied}
                onChange={(e) =>
                  setNewRecord((p) => ({ ...p, proxied: e.target.checked }))
                }
              />
              Proxied
            </label>
          </div>
        </div>

        <Button
          onClick={createRecord}
          disabled={
            !canAuth || !selectedZoneId || !newRecord.name || !newRecord.content
          }
        >
          <Plus className="w-4 h-4" />
          Tạo record
        </Button>
      </div>

      <div className="bg-background-secondary border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            DNS records
          </h2>
          <div className="text-sm text-text-muted">
            {records.length} records
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-text-muted">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-left py-2 pr-4 font-medium">Name</th>
                <th className="text-left py-2 pr-4 font-medium">Content</th>
                <th className="text-left py-2 pr-4 font-medium">TTL</th>
                <th className="text-left py-2 pr-4 font-medium">Proxied</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 text-text-primary font-medium">
                    {r.type}
                  </td>
                  <td className="py-2 pr-4">{r.name}</td>
                  <td
                    className="py-2 pr-4 max-w-[520px] truncate"
                    title={r.content}
                  >
                    {r.content}
                  </td>
                  <td className="py-2 pr-4">{r.ttl}</td>
                  <td className="py-2 pr-4">{r.proxied ? "Yes" : "No"}</td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => deleteRecord(r.id)}
                      className="text-status-stopped hover:text-status-stopped"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa
                    </Button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    Chưa có dữ liệu. Hãy tải zones → chọn zone → tải records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
