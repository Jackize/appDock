import { Button } from "@/components/ui/Button";
import { useContainerInspect } from "@/hooks/useDocker";
import type { Container } from "@/types";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy } from "lucide-react";

interface ContainerInspectDialogProps {
  open: boolean;
  container: Container | null;
  onOpenChange: (open: boolean) => void;
}

export function ContainerInspectDialog({
  open,
  container,
  onOpenChange,
}: ContainerInspectDialogProps) {
  const inspectQuery = useContainerInspect(container?.id ?? "", open && !!container);

  const handleCopyInspect = async () => {
    const data = inspectQuery.data;
    if (!data) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch {
      // Clipboard access can be blocked by browser permissions.
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background-secondary p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-text-primary">
                Inspect container
              </Dialog.Title>
              <Dialog.Description className="text-sm text-text-secondary mt-1">
                {container ? (
                  <>
                    <span className="font-medium text-text-primary">
                      {container.name}
                    </span>{" "}
                    <span className="break-all font-mono text-xs text-text-muted">
                      ({container.id})
                    </span>
                  </>
                ) : (
                  "-"
                )}
              </Dialog.Description>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyInspect}
                disabled={!inspectQuery.data}
                title="Copy JSON"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
              <Dialog.Close asChild>
                <Button variant="secondary" size="sm">
                  Đóng
                </Button>
              </Dialog.Close>
            </div>
          </div>

          <div className="mt-4 flex-1 overflow-auto rounded-lg border border-border bg-background-tertiary">
            {inspectQuery.isLoading ? (
              <div className="p-4 text-sm text-text-muted">Đang tải...</div>
            ) : inspectQuery.error ? (
              <div className="p-4 text-sm text-status-stopped">
                Lỗi: {(inspectQuery.error as Error).message}
              </div>
            ) : inspectQuery.data ? (
              <pre className="p-4 text-xs text-text-secondary whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(inspectQuery.data, null, 2)}
              </pre>
            ) : (
              <div className="p-4 text-sm text-text-muted">Không có dữ liệu</div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
