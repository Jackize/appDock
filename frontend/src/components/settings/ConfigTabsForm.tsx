import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ConfigField, ConfigSchemaResponse, ConfigTab } from "@/services/api";
import { cn } from "@/lib/utils";
import { RefreshCw, Save, Wand2 } from "lucide-react";

type Props = {
  schema: ConfigSchemaResponse;
  loading?: boolean;
  savingTabId?: string | null;
  onReload: () => Promise<void>;
  onSaveTab: (tabId: string, values: Record<string, string | number | boolean>) => Promise<void>;
  onGenerateJWTSecret: () => Promise<void>;
};

function isSecret(field: ConfigField) {
  return field.type === "secret";
}

function fieldDefaultValue(field: ConfigField): string | number | boolean {
  if (field.type === "boolean") return Boolean(field.value);
  if (field.type === "number") return typeof field.value === "number" ? field.value : 0;
  return typeof field.value === "string" ? field.value : "";
}

export function ConfigTabsForm({
  schema,
  loading,
  savingTabId,
  onReload,
  onSaveTab,
  onGenerateJWTSecret,
}: Props) {
  const tabs = schema.tabs ?? [];
  const defaultTabId = tabs[0]?.id ?? "user";
  const [activeTabId, setActiveTabId] = useState(defaultTabId);

  const activeTab: ConfigTab | undefined = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );

  const [valuesByKey, setValuesByKey] = useState<Record<string, string | number | boolean>>({});

  // Initialize values from schema (without filling secrets).
  useEffect(() => {
    const next: Record<string, string | number | boolean> = {};
    for (const tab of tabs) {
      for (const f of tab.fields) {
        if (isSecret(f)) continue;
        next[f.key] = fieldDefaultValue(f);
      }
    }
    setValuesByKey((prev) => ({ ...next, ...prev }));
  }, [tabs]);

  const renderField = (field: ConfigField) => {
    const commonLabel = (
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-text-primary">{field.label}</div>
        {field.type === "secret" ? (
          <div className="text-xs text-text-muted">
            {field.configured ? "configured" : "not configured"}
          </div>
        ) : null}
      </div>
    );

    if (field.type === "boolean") {
      const checked = Boolean(valuesByKey[field.key] ?? field.value ?? false);
      return (
        <div key={field.key} className="space-y-1">
          {commonLabel}
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setValuesByKey((p) => ({ ...p, [field.key]: e.target.checked }))}
            />
            {field.help ? <span className="text-text-muted">{field.help}</span> : null}
          </label>
        </div>
      );
    }

    if (field.type === "select") {
      const value = String(valuesByKey[field.key] ?? field.value ?? "");
      return (
        <div key={field.key} className="space-y-1">
          {commonLabel}
          <select
            className="input w-full"
            value={value}
            onChange={(e) => setValuesByKey((p) => ({ ...p, [field.key]: e.target.value }))}
          >
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {field.help ? <div className="text-xs text-text-muted">{field.help}</div> : null}
        </div>
      );
    }

    if (field.type === "number") {
      const value = Number(valuesByKey[field.key] ?? field.value ?? 0);
      return (
        <div key={field.key} className="space-y-1">
          {commonLabel}
          <input
            type="number"
            className="input w-full"
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) =>
              setValuesByKey((p) => ({ ...p, [field.key]: Number(e.target.value) }))
            }
            placeholder={field.placeholder}
          />
          {field.help ? <div className="text-xs text-text-muted">{field.help}</div> : null}
        </div>
      );
    }

    if (field.type === "secret") {
      const value = String(valuesByKey[field.key] ?? "");
      const isJWTSecret = field.key === "APPDOCK_JWT_SECRET";
      return (
        <div key={field.key} className="space-y-1">
          {commonLabel}
          <div className="flex gap-2">
            <input
              type="password"
              className="input w-full"
              value={value}
              onChange={(e) => setValuesByKey((p) => ({ ...p, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
            />
            {isJWTSecret ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onGenerateJWTSecret}
                title="Generate a new JWT secret"
              >
                <Wand2 className="w-4 h-4" />
                Generate
              </Button>
            ) : null}
          </div>
          {field.help ? <div className="text-xs text-text-muted">{field.help}</div> : null}
        </div>
      );
    }

    // string (default)
    const value = String(valuesByKey[field.key] ?? field.value ?? "");
    return (
      <div key={field.key} className="space-y-1">
        {commonLabel}
        <input
          type="text"
          className="input w-full"
          value={value}
          onChange={(e) => setValuesByKey((p) => ({ ...p, [field.key]: e.target.value }))}
          placeholder={field.placeholder}
        />
        {field.help ? <div className="text-xs text-text-muted">{field.help}</div> : null}
      </div>
    );
  };

  const saveActiveTab = async () => {
    if (!activeTab) return;
    const payload: Record<string, string | number | boolean> = {};
    for (const f of activeTab.fields) {
      if (isSecret(f)) {
        const v = String(valuesByKey[f.key] ?? "").trim();
        if (v) payload[f.key] = v;
        continue;
      }
      payload[f.key] = fieldDefaultValue({
        ...f,
        value: valuesByKey[f.key] ?? f.value,
      });
    }
    await onSaveTab(activeTab.id, payload);
    // Clear secrets after save
    setValuesByKey((p) => {
      const next = { ...p };
      for (const f of activeTab.fields) {
        if (isSecret(f)) next[f.key] = "";
      }
      return next;
    });
  };

  return (
    <div className="bg-background-secondary border border-border rounded-xl">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTabId(t.id)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap",
                activeTabId === t.id
                  ? "bg-accent/10 border-accent text-text-primary"
                  : "bg-background-tertiary/30 border-border text-text-muted hover:text-text-primary",
              )}
            >
              {t.title}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" loading={loading} onClick={onReload}>
            <RefreshCw className="w-4 h-4" />
            Reload
          </Button>
          <Button
            type="button"
            loading={savingTabId === activeTabId}
            onClick={saveActiveTab}
            disabled={!activeTab}
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="p-5">
        {!activeTab ? (
          <div className="text-sm text-text-muted">No settings available.</div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="text-lg font-semibold text-text-primary">{activeTab.title}</div>
              {activeTab.description ? (
                <div className="text-sm text-text-muted mt-0.5">{activeTab.description}</div>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeTab.fields.map(renderField)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

