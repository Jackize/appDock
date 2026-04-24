import { ConfirmDialog } from "@/components/resource/ConfirmDialog";
import { PageHeader } from "@/components/resource/PageHeader";
import { ResourceSection } from "@/components/resource/ResourceSection";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ImageTable } from "@/features/images/ImageTable";
import { PullImageDialog } from "@/features/images/PullImageDialog";
import {
  filterImages,
  getSelectedImagesSize,
  getSelectionState,
  splitImagesByUsage,
} from "@/features/images/imageUtils";
import { useBulkRemoveImages, useImages, useRemoveImage } from "@/hooks/useDocker";
import { formatBytes } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { Image } from "@/types";
import {
  CheckCircle,
  Download,
  Image as ImageIcon,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

export function Images() {
  const { data: images, isLoading, error } = useImages();
  const searchQuery = useAppStore((state) => state.searchQuery);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const removeMutation = useRemoveImage();
  const bulkRemoveMutation = useBulkRemoveImages();

  const filteredImages = useMemo(
    () => filterImages(images, searchQuery),
    [images, searchQuery],
  );

  const { inUseImages, unusedImages } = useMemo(
    () => splitImagesByUsage(filteredImages),
    [filteredImages],
  );

  const selectedVisibleImageIds = useMemo(
    () =>
      new Set(
        unusedImages
          .filter((image) => selectedImages.has(image.id))
          .map((image) => image.id),
      ),
    [selectedImages, unusedImages],
  );

  const selectionState = useMemo(
    () => getSelectionState(unusedImages, selectedImages),
    [selectedImages, unusedImages],
  );

  const selectedTotalSize = useMemo(
    () => getSelectedImagesSize(unusedImages, selectedVisibleImageIds),
    [selectedVisibleImageIds, unusedImages],
  );

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (selectionState.allSelected) {
        unusedImages.forEach((image) => next.delete(image.id));
      } else {
        unusedImages.forEach((image) => next.add(image.id));
      }
      return next;
    });
  };

  const handleDelete = () => {
    if (!imageToDelete) return;
    removeMutation.mutate(
      { id: imageToDelete.id, force: true },
      { onSuccess: () => setImageToDelete(null) },
    );
  };

  const requestDeleteImage = (image: Image) => {
    setImageToDelete(image);
  };

  const handleBulkDelete = () => {
    const imagesToDelete = Array.from(selectedVisibleImageIds);
    if (imagesToDelete.length === 0) return;

    bulkRemoveMutation.mutate(
      { ids: imagesToDelete, force: true },
      {
        onSuccess: () => {
          setSelectedImages(new Set());
          setBulkDeleteDialogOpen(false);
        },
      },
    );
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-stopped">Lỗi: {error.message}</p>
      </div>
    );
  }

  const selectedVisibleCount = selectedVisibleImageIds.size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Images"
        description="Quản lý các Docker images"
        stats={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-status-running/20 text-status-running flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {inUseImages.length} đang dùng
            </span>
            <span className="px-2 py-1 rounded bg-text-muted/20 text-text-muted flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              {unusedImages.length} không dùng
            </span>
          </div>
        }
        actions={
          <Button className="w-full sm:w-auto" onClick={() => setPullDialogOpen(true)}>
            <Download className="w-4 h-4" />
            Pull Image
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable />
      ) : images && images.length > 0 ? (
        <div className="space-y-6">
          <ResourceSection
            title="Images đang sử dụng"
            description="Các images đang được container sử dụng"
            icon={
              <div className="w-8 h-8 rounded-lg bg-status-running/20 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-status-running" />
              </div>
            }
          >
            {inUseImages.length > 0 ? (
              <ImageTable images={inUseImages} onDelete={requestDeleteImage} />
            ) : (
              <div className="py-8 text-center text-text-muted">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Không có image nào đang được sử dụng</p>
              </div>
            )}
          </ResourceSection>

          <ResourceSection
            title="Images không sử dụng"
            description="Các images không được container nào sử dụng"
            icon={
              <div className="w-8 h-8 rounded-lg bg-text-muted/20 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-text-muted" />
              </div>
            }
            actions={
              <UnusedImagesActions
                selectedCount={selectedVisibleCount}
                selectedTotalSize={selectedTotalSize}
                hasUnusedImages={unusedImages.length > 0}
                onBulkDelete={() => setBulkDeleteDialogOpen(true)}
              />
            }
          >
            {unusedImages.length > 0 ? (
              <ImageTable
                images={unusedImages}
                onDelete={requestDeleteImage}
                selectedImages={selectedVisibleImageIds}
                selectAllState={selectionState.checkboxState}
                onToggleImage={toggleImageSelection}
                onToggleAll={toggleSelectAll}
              />
            ) : (
              <div className="py-8 text-center text-text-muted">
                <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Tất cả images đều đang được sử dụng</p>
              </div>
            )}
          </ResourceSection>
        </div>
      ) : (
        <EmptyState
          icon={<ImageIcon className="w-8 h-8" />}
          title="Chưa có image nào"
          description="Bạn chưa có image nào. Hãy pull image từ Docker Hub để bắt đầu."
          action={
            <Button onClick={() => setPullDialogOpen(true)}>
              <Download className="w-4 h-4" />
              Pull Image
            </Button>
          }
        />
      )}

      <PullImageDialog open={pullDialogOpen} onOpenChange={setPullDialogOpen} />

      <ConfirmDialog
        open={!!imageToDelete}
        onOpenChange={(open) => !open && setImageToDelete(null)}
        title="Xác nhận xóa image"
        description={
          imageToDelete?.inUse ? (
            <span className="text-status-paused">
              Image này đang được sử dụng bởi {imageToDelete.containers.length}{" "}
              container(s). Bạn cần dừng và xóa các containers trước khi xóa image này.
            </span>
          ) : (
            <>
              Bạn có chắc muốn xóa image{" "}
              <span className="font-medium text-text-primary font-mono">
                {imageToDelete?.id}
              </span>
              ? Hành động này không thể hoàn tác.
            </>
          )
        }
        confirmLabel="Xóa image"
        loading={removeMutation.isPending}
        confirmDisabled={imageToDelete?.inUse}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={`Xóa ${selectedVisibleCount} images`}
        description={
          <>
            <p>Bạn có chắc muốn xóa {selectedVisibleCount} images đã chọn?</p>
            <p className="mt-2 text-accent">
              Sẽ giải phóng khoảng {formatBytes(selectedTotalSize)} dung lượng.
            </p>
            <p className="mt-2 text-status-paused text-xs">
              Hành động này không thể hoàn tác.
            </p>
          </>
        }
        confirmLabel={`Xóa ${selectedVisibleCount} images`}
        loading={bulkRemoveMutation.isPending}
        confirmDisabled={selectedVisibleCount === 0}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}

function UnusedImagesActions({
  selectedCount,
  selectedTotalSize,
  hasUnusedImages,
  onBulkDelete,
}: {
  selectedCount: number;
  selectedTotalSize: number;
  hasUnusedImages: boolean;
  onBulkDelete: () => void;
}) {
  if (selectedCount > 0) {
    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-sm text-text-secondary">
          Đã chọn {selectedCount} images ({formatBytes(selectedTotalSize)})
        </span>
        <Button className="w-full sm:w-auto" variant="danger" size="sm" onClick={onBulkDelete}>
          <Trash2 className="w-4 h-4" />
          Xóa đã chọn
        </Button>
      </div>
    );
  }

  if (!hasUnusedImages) return null;

  return (
    <span className="text-xs text-status-paused bg-status-paused/10 px-2 py-1 rounded">
      Có thể xóa để giải phóng dung lượng
    </span>
  );
}
