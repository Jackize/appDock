import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  useBulkRemoveImages,
  useImages,
  usePullImage,
  useRemoveImage,
} from "@/hooks/useDocker";
import { formatBytes, formatRelativeTime, truncate } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { Image } from "@/types";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
// import { Checkbox } from "radix-ui";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Check,
  CheckCircle,
  Container,
  Download,
  Image as ImageIcon,
  Minus,
  MoreVertical,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

export function Images() {
  const { data: images, isLoading, error } = useImages();
  const searchQuery = useAppStore((state) => state.searchQuery);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [pullImageName, setPullImageName] = useState("");

  // State cho bulk selection
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const removeMutation = useRemoveImage();
  const pullMutation = usePullImage();
  const bulkRemoveMutation = useBulkRemoveImages();

  // Filter và phân loại images
  const { inUseImages, unusedImages } = useMemo(() => {
    if (!images) return { inUseImages: [], unusedImages: [] };

    const filtered = images.filter(
      (img) =>
        img.repoTags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        ) || img.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
      inUseImages: filtered.filter((img) => img.inUse),
      unusedImages: filtered.filter((img) => !img.inUse),
    };
  }, [images, searchQuery]);

  // Tính toán trạng thái select all
  const allUnusedSelected =
    unusedImages.length > 0 &&
    unusedImages.every((img) => selectedImages.has(img.id));
  const someUnusedSelected = unusedImages.some((img) =>
    selectedImages.has(img.id)
  );

  // Tính tổng dung lượng các images đã chọn
  const selectedTotalSize = useMemo(() => {
    return unusedImages
      .filter((img) => selectedImages.has(img.id))
      .reduce((acc, img) => acc + img.size, 0);
  }, [unusedImages, selectedImages]);

  const handleDelete = () => {
    if (imageToDelete) {
      removeMutation.mutate(
        { id: imageToDelete.id, force: true },
        { onSuccess: () => setImageToDelete(null) }
      );
    }
  };

  const handlePull = () => {
    if (pullImageName.trim()) {
      pullMutation.mutate(pullImageName.trim(), {
        onSuccess: () => {
          setPullDialogOpen(false);
          setPullImageName("");
        },
      });
    }
  };

  // Toggle chọn một image
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  // Toggle chọn tất cả unused images
  const toggleSelectAll = () => {
    if (allUnusedSelected) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(unusedImages.map((img) => img.id)));
    }
  };

  // Xóa tất cả images đã chọn (sử dụng bulk API)
  const handleBulkDelete = () => {
    const imagesToDelete = Array.from(selectedImages);

    bulkRemoveMutation.mutate(
      { ids: imagesToDelete, force: true },
      {
        onSuccess: () => {
          setSelectedImages(new Set());
          setBulkDeleteDialogOpen(false);
        },
      }
    );
  };

  const getMainTag = (repoTags: string[]) => {
    if (!repoTags || repoTags.length === 0 || repoTags[0] === "<none>:<none>") {
      return "<không có tag>";
    }
    return repoTags[0];
  };

  // Component hiển thị một image row (cho images đang sử dụng)
  const ImageRow = ({ image }: { image: Image }) => {
    const mainTag = getMainTag(image.repoTags);
    const [name, tag] = mainTag.includes(":")
      ? mainTag.split(":")
      : [mainTag, "latest"];

    return (
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                image.inUse ? "bg-status-running/10" : "bg-accent/10"
              }`}
            >
              <ImageIcon
                className={`w-5 h-5 ${
                  image.inUse ? "text-status-running" : "text-accent"
                }`}
              />
            </div>
            <div>
              <span className="font-medium">{truncate(name, 35)}</span>
              {image.inUse && image.containers.length > 0 && (
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-status-running cursor-help">
                        <Container className="w-3 h-3" />
                        <span>{image.containers.length} container(s)</span>
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-sm shadow-lg z-50"
                        sideOffset={5}
                      >
                        <p className="font-medium text-text-primary mb-1">
                          Được sử dụng bởi:
                        </p>
                        <ul className="text-text-secondary">
                          {image.containers.map((c, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-running" />
                              {c}
                            </li>
                          ))}
                        </ul>
                        <Tooltip.Arrow className="fill-background-secondary" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{tag}</Badge>
        </TableCell>
        <TableCell>
          <span className="font-mono text-text-muted text-xs">{image.id}</span>
        </TableCell>
        <TableCell>
          <span className="text-text-secondary">{formatBytes(image.size)}</span>
        </TableCell>
        <TableCell>
          <span className="text-text-secondary">
            {formatRelativeTime(image.created)}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[160px] bg-background-secondary border border-border rounded-lg p-1 shadow-lg z-50"
                  sideOffset={5}
                >
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none">
                    <ImageIcon className="w-4 h-4" />
                    Xem chi tiết
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px bg-border my-1" />
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm text-status-stopped hover:bg-status-stopped/10 rounded cursor-pointer outline-none"
                    onClick={() => setImageToDelete(image)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa image
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Component hiển thị một unused image row với checkbox
  const UnusedImageRow = ({ image }: { image: Image }) => {
    const mainTag = getMainTag(image.repoTags);
    const [name, tag] = mainTag.includes(":")
      ? mainTag.split(":")
      : [mainTag, "latest"];
    const isSelected = selectedImages.has(image.id);

    return (
      <TableRow className={isSelected ? "bg-accent/5" : ""}>
        <TableCell className="w-12">
          <Checkbox.Root
            checked={isSelected}
            onCheckedChange={() => toggleImageSelection(image.id)}
            className="w-5 h-5 rounded border border-border bg-background-tertiary flex items-center justify-center data-[state=checked]:bg-accent data-[state=checked]:border-accent transition-colors"
          >
            <Checkbox.Indicator>
              <Check className="w-3.5 h-3.5 text-white" />
            </Checkbox.Indicator>
          </Checkbox.Root>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-accent" />
            </div>
            <span className="font-medium">{truncate(name, 35)}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{tag}</Badge>
        </TableCell>
        <TableCell>
          <span className="font-mono text-text-muted text-xs">{image.id}</span>
        </TableCell>
        <TableCell>
          <span className="text-text-secondary">{formatBytes(image.size)}</span>
        </TableCell>
        <TableCell>
          <span className="text-text-secondary">
            {formatRelativeTime(image.created)}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[160px] bg-background-secondary border border-border rounded-lg p-1 shadow-lg z-50"
                  sideOffset={5}
                >
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none">
                    <ImageIcon className="w-4 h-4" />
                    Xem chi tiết
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px bg-border my-1" />
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm text-status-stopped hover:bg-status-stopped/10 rounded cursor-pointer outline-none"
                    onClick={() => setImageToDelete(image)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa image
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Component bảng images đang sử dụng
  const ImageTable = ({ images: imgList }: { images: Image[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Image</TableHead>
          <TableHead>Tag</TableHead>
          <TableHead>ID</TableHead>
          <TableHead>Kích thước</TableHead>
          <TableHead>Tạo lúc</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {imgList.map((image) => (
          <ImageRow key={image.id} image={image} />
        ))}
      </TableBody>
    </Table>
  );

  // Component bảng unused images với checkbox
  const UnusedImageTable = ({ images: imgList }: { images: Image[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox.Root
              checked={
                allUnusedSelected
                  ? true
                  : someUnusedSelected
                  ? "indeterminate"
                  : false
              }
              onCheckedChange={toggleSelectAll}
              className="w-5 h-5 rounded border border-border bg-background-tertiary flex items-center justify-center data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:border-accent transition-colors"
            >
              <Checkbox.Indicator>
                {allUnusedSelected ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-white" />
                )}
              </Checkbox.Indicator>
            </Checkbox.Root>
          </TableHead>
          <TableHead>Image</TableHead>
          <TableHead>Tag</TableHead>
          <TableHead>ID</TableHead>
          <TableHead>Kích thước</TableHead>
          <TableHead>Tạo lúc</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {imgList.map((image) => (
          <UnusedImageRow key={image.id} image={image} />
        ))}
      </TableBody>
    </Table>
  );

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-stopped">Lỗi: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Images</h1>
          <p className="text-text-secondary mt-1">Quản lý các Docker images</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-status-running/20 text-status-running flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {inUseImages.length} đang dùng
            </span>
            <span className="px-2 py-1 rounded bg-text-muted/20 text-text-muted flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              {unusedImages.length} không dùng
            </span>
          </div>
          <Button onClick={() => setPullDialogOpen(true)}>
            <Download className="w-4 h-4" />
            Pull Image
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable />
      ) : images && images.length > 0 ? (
        <div className="space-y-6">
          {/* Images đang sử dụng */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-status-running/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-status-running" />
                </div>
                <div>
                  <CardTitle>Images đang sử dụng</CardTitle>
                  <p className="text-sm text-text-muted">
                    Các images đang được container sử dụng
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {inUseImages.length > 0 ? (
                <ImageTable images={inUseImages} />
              ) : (
                <div className="py-8 text-center text-text-muted">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Không có image nào đang được sử dụng</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images không sử dụng */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-text-muted/20 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-text-muted" />
                  </div>
                  <div>
                    <CardTitle>Images không sử dụng</CardTitle>
                    <p className="text-sm text-text-muted">
                      Các images không được container nào sử dụng
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedImages.size > 0 && (
                    <>
                      <span className="text-sm text-text-secondary">
                        Đã chọn {selectedImages.size} images (
                        {formatBytes(selectedTotalSize)})
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setBulkDeleteDialogOpen(true)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Xóa đã chọn
                      </Button>
                    </>
                  )}
                  {selectedImages.size === 0 && unusedImages.length > 0 && (
                    <span className="text-xs text-status-paused bg-status-paused/10 px-2 py-1 rounded">
                      Có thể xóa để giải phóng dung lượng
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {unusedImages.length > 0 ? (
                <UnusedImageTable images={unusedImages} />
              ) : (
                <div className="py-8 text-center text-text-muted">
                  <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Tất cả images đều đang được sử dụng</p>
                </div>
              )}
            </CardContent>
          </Card>
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

      {/* Pull Image Dialog */}
      <Dialog.Root open={pullDialogOpen} onOpenChange={setPullDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Pull Image
            </Dialog.Title>
            <Dialog.Description className="text-sm text-text-secondary mt-2">
              Nhập tên image để tải về từ Docker Hub
            </Dialog.Description>
            <div className="mt-4">
              <input
                type="text"
                placeholder="Ví dụ: nginx:latest, postgres:15"
                value={pullImageName}
                onChange={(e) => setPullImageName(e.target.value)}
                className="input w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary">Hủy</Button>
              </Dialog.Close>
              <Button
                onClick={handlePull}
                loading={pullMutation.isPending}
                disabled={!pullImageName.trim()}
              >
                <Download className="w-4 h-4" />
                Pull
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete single image confirmation dialog */}
      <AlertDialog.Root
        open={!!imageToDelete}
        onOpenChange={(open) => !open && setImageToDelete(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-semibold text-text-primary">
              Xác nhận xóa image
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-text-secondary mt-2">
              {imageToDelete?.inUse ? (
                <span className="text-status-paused">
                  ⚠️ Image này đang được sử dụng bởi{" "}
                  {imageToDelete.containers.length} container(s). Bạn cần dừng
                  và xóa các containers trước khi xóa image này.
                </span>
              ) : (
                <>
                  Bạn có chắc muốn xóa image{" "}
                  <span className="font-medium text-text-primary font-mono">
                    {imageToDelete?.id}
                  </span>
                  ? Hành động này không thể hoàn tác.
                </>
              )}
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Hủy</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  loading={removeMutation.isPending}
                >
                  Xóa image
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Bulk delete confirmation dialog */}
      <AlertDialog.Root
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-semibold text-text-primary">
              Xóa {selectedImages.size} images
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-text-secondary mt-2">
              <p>Bạn có chắc muốn xóa {selectedImages.size} images đã chọn?</p>
              <p className="mt-2 text-accent">
                Sẽ giải phóng khoảng {formatBytes(selectedTotalSize)} dung
                lượng.
              </p>
              <p className="mt-2 text-status-paused text-xs">
                ⚠️ Hành động này không thể hoàn tác.
              </p>
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Hủy</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="danger"
                  onClick={handleBulkDelete}
                  loading={bulkRemoveMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa {selectedImages.size} images
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
