import { useMemo, useState } from "react";
import { Mail, Users, Trash2, RefreshCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/stores/appStore";
import { useCreateInvite, useInvites, useRevokeInvite } from "@/hooks/useInvites";
import { cn } from "@/lib/utils";

function formatDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function inviteStatusClass(status: string) {
  switch (status) {
    case "accepted":
      return "bg-status-running/10 border-status-running/20 text-status-running";
    case "pending":
      return "bg-status-paused/10 border-status-paused/20 text-status-paused";
    case "revoked":
      return "bg-status-stopped/10 border-status-stopped/20 text-status-stopped";
    default:
      return "bg-background-tertiary border-border text-text-secondary";
  }
}

export function Members() {
  const addToast = useAppStore((state) => state.addToast);
  const [email, setEmail] = useState("");

  const invitesQuery = useInvites();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();

  const invites = useMemo(() => invitesQuery.data?.invites ?? [], [invitesQuery.data]);

  const onInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      const res = await createInvite.mutateAsync(trimmed);
      setEmail("");
      if (res.emailError) {
        addToast({
          title: "Invite đã tạo",
          description: `Không gửi được email: ${res.emailError}. Bạn có thể copy link invite.`,
          variant: "warning",
        });
      } else {
        addToast({
          title: "Thành công",
          description: "Đã gửi email mời thành viên",
          variant: "success",
        });
      }
    } catch (e) {
      addToast({
        title: "Lỗi",
        description: e instanceof Error ? e.message : "Không thể tạo invite",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Members</h1>
        <p className="text-text-secondary mt-1">
          Chỉ email được mời và chấp nhận invite mới có thể đăng nhập bằng Google.
        </p>
      </div>

      <div className="bg-background-secondary border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Mời thành viên</h2>
            <p className="text-sm text-text-muted">Gửi link invite qua email (SendGrid)</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full !pl-10"
              placeholder="email@example.com"
              autoComplete="email"
            />
          </div>
          <Button
            onClick={onInvite}
            loading={createInvite.isPending}
            disabled={!email.trim()}
          >
            Mời
          </Button>
          <Button
            variant="secondary"
            onClick={() => invitesQuery.refetch()}
            loading={invitesQuery.isFetching}
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-background-secondary border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Danh sách invites</h2>
            <p className="text-sm text-text-muted">
              {invitesQuery.isLoading ? "Đang tải..." : `${invites.length} invites`}
            </p>
          </div>
        </div>

        {invitesQuery.isError ? (
          <div className="text-sm text-status-stopped">
            {(invitesQuery.error as Error)?.message || "Không thể tải danh sách invites"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-3 pr-3">Email</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Expires</th>
                  <th className="py-3 pr-3">Accepted</th>
                  <th className="py-3 pr-3">InvitedBy</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.email} className="border-b border-border/60">
                    <td className="py-3 pr-3 text-text-primary">{inv.email}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-md border font-medium",
                          inviteStatusClass(inv.status),
                        )}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-text-secondary">{formatDate(inv.expiresAt)}</td>
                    <td className="py-3 pr-3 text-text-secondary">{formatDate(inv.acceptedAt ?? undefined)}</td>
                    <td className="py-3 pr-3 text-text-secondary">{inv.invitedBy || "—"}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-2">
                        {"inviteLink" in inv ? null : null}
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2 inline-flex items-center gap-2"
                          onClick={() => {
                            // Invite link is returned on create; for listing we can't reconstruct without token.
                            addToast({
                              title: "Copy link",
                              description:
                                "Vì token không được lưu lại (security), hãy tạo lại invite để nhận link mới.",
                              variant: "default",
                            });
                          }}
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-3 py-2 inline-flex items-center gap-2"
                          disabled={revokeInvite.isPending}
                          onClick={async () => {
                            try {
                              await revokeInvite.mutateAsync(inv.email);
                              addToast({
                                title: "Thành công",
                                description: "Đã thu hồi invite",
                                variant: "success",
                              });
                            } catch (e) {
                              addToast({
                                title: "Lỗi",
                                description:
                                  e instanceof Error ? e.message : "Không thể thu hồi invite",
                                variant: "error",
                              });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invites.length === 0 && !invitesQuery.isLoading && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-text-muted">
                      Chưa có invite nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

