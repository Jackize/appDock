import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatBytes, formatRelativeTime, truncate } from "@/lib/utils";
import type { Image } from "@/types";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Container, Image as ImageIcon } from "lucide-react";
import { ImageActionsMenu } from "./ImageActionsMenu";
import { parseImageTag } from "./imageUtils";

interface ImageTableProps {
  images: Image[];
  onDelete: (image: Image) => void;
  selectedImages?: Set<string>;
  selectAllState?: boolean | "indeterminate";
  onToggleImage?: (imageId: string) => void;
  onToggleAll?: () => void;
}

export function ImageTable({
  images,
  onDelete,
  selectedImages,
  selectAllState = false,
  onToggleImage,
  onToggleAll,
}: ImageTableProps) {
  const selectable = !!selectedImages && !!onToggleImage && !!onToggleAll;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-12">
              <Checkbox
                checked={selectAllState}
                onCheckedChange={onToggleAll}
                aria-label="Chọn tất cả images không sử dụng"
              />
            </TableHead>
          )}
          <TableHead>Image</TableHead>
          <TableHead>Tag</TableHead>
          <TableHead>ID</TableHead>
          <TableHead>Kích thước</TableHead>
          <TableHead>Tạo lúc</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {images.map((image) => (
          <ImageRow
            key={image.id}
            image={image}
            selectable={selectable}
            selected={selectedImages?.has(image.id) ?? false}
            onToggleImage={onToggleImage}
            onDelete={onDelete}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface ImageRowProps {
  image: Image;
  selectable: boolean;
  selected: boolean;
  onToggleImage?: (imageId: string) => void;
  onDelete: (image: Image) => void;
}

function ImageRow({
  image,
  selectable,
  selected,
  onToggleImage,
  onDelete,
}: ImageRowProps) {
  const { name, tag } = parseImageTag(image.repoTags);

  return (
    <TableRow className={selected ? "bg-accent/5" : ""}>
      {selectable && (
        <TableCell className="w-12">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleImage?.(image.id)}
            aria-label={`Chọn image ${name}`}
          />
        </TableCell>
      )}
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
              <ImageUsageTooltip containers={image.containers} />
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
        <ImageActionsMenu image={image} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
}

function ImageUsageTooltip({ containers }: { containers: string[] }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-status-running cursor-help">
            <Container className="w-3 h-3" />
            <span>{containers.length} container(s)</span>
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
              {containers.map((container, index) => (
                <li key={`${container}-${index}`} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-running" />
                  {container}
                </li>
              ))}
            </ul>
            <Tooltip.Arrow className="fill-background-secondary" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
