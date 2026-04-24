import { Button } from "@/components/ui/Button";
import type { Image } from "@/types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Image as ImageIcon, MoreVertical, Trash2 } from "lucide-react";

interface ImageActionsMenuProps {
  image: Image;
  onDelete: (image: Image) => void;
}

export function ImageActionsMenu({ image, onDelete }: ImageActionsMenuProps) {
  return (
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
              onClick={() => onDelete(image)}
            >
              <Trash2 className="w-4 h-4" />
              Xóa image
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
