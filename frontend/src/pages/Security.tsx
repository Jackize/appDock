import { useMemo, useState } from "react";
import {
  Shield,
  RefreshCw,
  Loader2,
  MessageSquare,
  FileText,
  Play,
  AlertTriangle,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  useNetworkSnapshot,
  useSecurityReports,
  useAnalyzeSecurity,
  usePatchSecurityReport,
  useSecurityChat,
} from "@/hooks/useSecurity";
import { useServerStore } from "@/stores/serverStore";
import { cn } from "@/lib/utils";
import type { SecurityReport } from "@/types";

type BadgeVariant = "default" | "running" | "stopped" | "paused" | "outline";

function severityVariant(s: string): BadgeVariant {
  const x = s?.toLowerCase() ?? "";
  if (x === "critical" || x === "high") return "stopped";
  if (x === "medium") return "paused";
  if (x === "low" || x === "info") return "running";
  return "default";
}

export default function Security() {
  const currentServerId = useServerStore((s) => s.currentServerId);
  const { data: snapshot, isLoading: snapLoading, error: snapError, refetch } =
    useNetworkSnapshot();
  const { data: reports, isLoading: reportsLoading, error: reportsError } =
    useSecurityReports();
  const analyze = useAnalyzeSecurity();
  const patchReport = usePatchSecurityReport();
  const chatMutation = useSecurityChat();

  const [detail, setDetail] = useState<SecurityReport | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: string; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [attachedReportId, setAttachedReportId] = useState<string>("");
  const [chatError, setChatError] = useState<string | null>(null);

  const topPeers = useMemo(
    () => snapshot?.topRemotePeers?.slice(0, 8) ?? [],
    [snapshot],
  );

  const handleAnalyze = () => {
    analyze.mutate({ force: true });
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatError(null);
    const next = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next);
    setChatInput("");
    try {
      const res = await chatMutation.mutateAsync({
        messages: next,
        reportId: attachedReportId || undefined,
      });
      setChatMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply },
      ]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Chat failed");
      setChatMessages((m) => m.slice(0, -1));
    }
  };

  const importReportJson = () => {
    const raw = prompt("Dán JSON báo cáo (từ API hoặc export):");
    if (!raw?.trim()) return;
    try {
      const parsed = JSON.parse(raw) as SecurityReport;
      if (parsed?.id) {
        setAttachedReportId(parsed.id);
        setChatError(null);
      }
    } catch {
      setChatError("JSON không hợp lệ");
    }
  };

  return (
    <div className="space-y-8 p-1">
      {analyze.isError && (
        <div className="rounded-lg border border-status-stopped/40 bg-status-stopped/10 px-4 py-3 text-sm text-status-stopped">
          Phân tích thất bại: {(analyze.error as Error).message}
        </div>
      )}

      {snapError && (
        <div className="flex items-start gap-2 rounded-lg border border-status-stopped/40 bg-status-stopped/10 px-4 py-3 text-sm text-text-primary">
          <AlertTriangle className="w-5 h-5 text-status-stopped shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Không tải được snapshot mạng</p>
            <p className="text-text-secondary mt-1">
              {(snapError as Error).message}. Kiểm tra backend, agent (máy
              remote), và quyền đọc /proc/net trên Linux.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Shield className="w-8 h-8 text-accent" />
            Bảo mật mạng & AI
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            Máy chủ đang chọn:{" "}
            <span className="text-accent font-medium">{currentServerId}</span> —
            phân tích heuristic + Gemini (khi có API key). Báo cáo lưu cục bộ
            trong thư mục dữ liệu backend.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={snapLoading}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", snapLoading && "animate-spin")}
            />
            Làm mới snapshot
          </Button>
          <Button onClick={handleAnalyze} disabled={analyze.isPending}>
            {analyze.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Phân tích ngay
          </Button>
          <Button variant="secondary" onClick={() => setChatOpen(true)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Trợ lý & báo cáo
          </Button>
        </div>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-background-secondary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">
            Hostname
          </p>
          <p className="text-lg font-semibold text-text-primary truncate">
            {snapLoading ? "…" : snapshot?.hostname ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">
            TCP sockets
          </p>
          <p className="text-lg font-semibold text-text-primary">
            {snapLoading ? "…" : snapshot?.tcpCount?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">
            Remote IP (ước lượng)
          </p>
          <p className="text-lg font-semibold text-text-primary">
            {snapLoading
              ? "…"
              : snapshot?.uniqueRemoteIps?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">
            UDP rows
          </p>
          <p className="text-lg font-semibold text-text-primary">
            {snapLoading ? "…" : snapshot?.udpCount?.toLocaleString() ?? "—"}
          </p>
        </div>
      </div>

      {snapshot?.tcpByStatus && (
        <div className="rounded-xl border border-border bg-background-secondary p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            TCP theo trạng thái
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(snapshot.tcpByStatus)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([k, v]) => (
                <Badge key={k} variant="default">
                  {k}: {v.toLocaleString()}
                </Badge>
              ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-background-secondary p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Top remote peers
        </h2>
        {snapLoading ? (
          <p className="text-text-muted text-sm">Đang tải…</p>
        ) : topPeers.length === 0 ? (
          <p className="text-text-muted text-sm">Không có dữ liệu.</p>
        ) : (
          <div className="space-y-1 font-mono text-sm">
            {topPeers.map((p) => (
              <div
                key={p.addr}
                className="flex justify-between text-text-secondary"
              >
                <span className="truncate mr-2">{p.addr}</span>
                <span>{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reports */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Báo cáo
          </h2>
          {reportsError && (
            <span className="text-xs text-status-stopped">
              {(reportsError as Error).message}
            </span>
          )}
        </div>
        {reportsLoading ? (
          <SkeletonTable />
        ) : !reports?.length ? (
          <p className="text-text-muted text-sm py-8 text-center border border-dashed border-border rounded-xl">
            Chưa có báo cáo. Chạy &quot;Phân tích ngay&quot; hoặc đợt quét nền
            (khi heuristic phát hiện bất thường và mức độ đủ cao).
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Nguồn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>&nbsp;</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(r.severity)}>
                        {r.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {r.title}
                    </TableCell>
                    <TableCell className="text-xs">{r.source}</TableCell>
                    <TableCell>
                      <select
                        className="bg-background-tertiary border border-border rounded px-2 py-1 text-xs"
                        value={r.status}
                        onChange={(e) =>
                          patchReport.mutate({
                            id: r.id,
                            status: e.target.value as SecurityReport["status"],
                          })
                        }
                      >
                        <option value="open">open</option>
                        <option value="acknowledged">acknowledged</option>
                        <option value="resolved">resolved</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetail(r)}
                      >
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog.Root open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(720px,94vw)] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background-secondary p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-text-primary mb-2">
              {detail?.title}
            </Dialog.Title>
            {detail && (
              <div className="space-y-3 text-sm text-text-secondary">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={severityVariant(detail.severity)}>
                    {detail.severity}
                  </Badge>
                  <Badge>{detail.aiAttackHypothesis ?? "—"}</Badge>
                </div>
                {detail.aiSummary && (
                  <div>
                    <p className="text-text-muted text-xs mb-1">Tóm tắt AI</p>
                    <p className="text-text-primary">{detail.aiSummary}</p>
                  </div>
                )}
                {detail.aiEvidence && (
                  <div>
                    <p className="text-text-muted text-xs mb-1">Bằng chứng</p>
                    <p>{detail.aiEvidence}</p>
                  </div>
                )}
                {detail.heuristicNotes && (
                  <div>
                    <p className="text-text-muted text-xs mb-1">Heuristic</p>
                    <p>{detail.heuristicNotes}</p>
                  </div>
                )}
                {detail.deltaSummary && (
                  <div>
                    <p className="text-text-muted text-xs mb-1">Delta</p>
                    <pre className="whitespace-pre-wrap text-xs bg-background-tertiary p-2 rounded">
                      {detail.deltaSummary}
                    </pre>
                  </div>
                )}
                {detail.recommendedActions &&
                  detail.recommendedActions.length > 0 && (
                    <div>
                      <p className="text-text-muted text-xs mb-1">
                        Gợi ý xử lý
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        {detail.recommendedActions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}
            <Dialog.Close asChild>
              <Button className="mt-4" variant="secondary">
                Đóng
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={chatOpen} onOpenChange={setChatOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,94vw)] max-h-[85vh] flex flex-col -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background-secondary p-4 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-text-primary mb-2">
              Trợ lý bảo mật (Gemini)
            </Dialog.Title>
            <p className="text-xs text-text-muted mb-3">
              Đính kèm báo cáo để hỏi theo ngữ cảnh, hoặc dán JSON báo cáo để
              nhập nhanh.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                className="flex-1 min-w-[180px] bg-background-tertiary border border-border rounded px-2 py-2 text-sm"
                value={attachedReportId}
                onChange={(e) => setAttachedReportId(e.target.value)}
              >
                <option value="">— Chọn báo cáo —</option>
                {reports?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.severity} · {r.title.slice(0, 40)}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" size="sm" onClick={importReportJson}>
                Import JSON
              </Button>
            </div>
            {chatError && (
              <p className="text-xs text-status-stopped mb-2">{chatError}</p>
            )}
            <div className="flex-1 min-h-[200px] max-h-[320px] overflow-y-auto space-y-2 border border-border rounded-lg p-2 mb-2 bg-background-tertiary/50">
              {chatMessages.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">
                  Hỏi về báo cáo, cách chặn IP, fail2ban, nginx rate limit…
                </p>
              ) : (
                chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-sm rounded-lg px-3 py-2",
                      m.role === "user"
                        ? "bg-accent/15 text-text-primary ml-8"
                        : "bg-background-secondary mr-8 text-text-secondary",
                    )}
                  >
                    <span className="text-xs font-semibold text-text-muted block mb-1">
                      {m.role}
                    </span>
                    {m.content}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                className="flex-1 bg-background-tertiary border border-border rounded-lg px-3 py-2 text-sm min-h-[72px]"
                placeholder="Nhập câu hỏi…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
              />
              <Button
                onClick={handleSendChat}
                disabled={chatMutation.isPending || !chatInput.trim()}
              >
                {chatMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Gửi"
                )}
              </Button>
            </div>
            <Dialog.Close asChild>
              <Button className="mt-3 w-full" variant="secondary">
                Đóng
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
