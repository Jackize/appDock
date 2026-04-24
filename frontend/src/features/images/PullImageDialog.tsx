import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { usePullImage, useRegistryProjects } from "@/hooks/useDocker";
import * as Dialog from "@radix-ui/react-dialog";
import { Download } from "lucide-react";
import { useState } from "react";

interface PullImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PullImageDialog({ open, onOpenChange }: PullImageDialogProps) {
  const [imageName, setImageName] = useState("");
  const [useRegistry, setUseRegistry] = useState(false);
  const [registryId, setRegistryId] = useState("");
  const [repository, setRepository] = useState("");
  const [tag, setTag] = useState("latest");
  const { data: registryProjects } = useRegistryProjects();
  const pullMutation = usePullImage();

  const resetRegistryFields = () => {
    setUseRegistry(false);
    setRegistryId("");
    setRepository("");
    setTag("latest");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetRegistryFields();
    }
  };

  const handlePull = () => {
    if (useRegistry) {
      if (!registryId || !repository.trim()) return;

      pullMutation.mutate(
        {
          registryProjectId: registryId,
          repository: repository.trim(),
          tag: tag.trim() || "latest",
        },
        {
          onSuccess: () => {
            handleOpenChange(false);
            setRepository("");
            setTag("latest");
          },
        },
      );
      return;
    }

    if (imageName.trim()) {
      pullMutation.mutate(imageName.trim(), {
        onSuccess: () => {
          handleOpenChange(false);
          setImageName("");
        },
      });
    }
  };

  const pullDisabled = useRegistry
    ? !registryId || !repository.trim() || pullMutation.isPending
    : !imageName.trim() || pullMutation.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold text-text-primary">
            Pull Image
          </Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary mt-2">
            {useRegistry
              ? "Dùng Registry project (Harbor / GHCR / private) với repository dưới namespace đã cấu hình."
              : "Nhập reference đầy đủ (Docker Hub hoặc registry khác)."}
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <Checkbox
                checked={useRegistry}
                onCheckedChange={(checked) => setUseRegistry(checked === true)}
              />
              Pull qua Registry project
            </label>

            {useRegistry ? (
              <>
                <select
                  value={registryId}
                  onChange={(event) => setRegistryId(event.target.value)}
                  className="input w-full"
                >
                  <option value="">Chọn registry project...</option>
                  {(registryProjects ?? []).map((registryProject) => (
                    <option key={registryProject.id} value={registryProject.id}>
                      {registryProject.name} ({registryProject.host})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Repository, ví dụ: nginx hoặc myapp/api"
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  className="input w-full"
                />
                <input
                  type="text"
                  placeholder="Tag (mặc định latest)"
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  className="input w-full"
                />
              </>
            ) : (
              <input
                type="text"
                placeholder="Ví dụ: nginx:latest, ghcr.io/org/app:main"
                value={imageName}
                onChange={(event) => setImageName(event.target.value)}
                className="input w-full"
                autoFocus
              />
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Dialog.Close asChild>
              <Button variant="secondary">Hủy</Button>
            </Dialog.Close>
            <Button
              onClick={handlePull}
              loading={pullMutation.isPending}
              disabled={pullDisabled}
            >
              <Download className="w-4 h-4" />
              Pull
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
