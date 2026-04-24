import { useAppStore } from "@/stores/appStore";

type ToastVariant = "default" | "success" | "error" | "warning";

export function useToastActions() {
  const addToast = useAppStore((state) => state.addToast);

  return {
    show(description: string, title = "Thông báo", variant: ToastVariant = "default") {
      addToast({ title, description, variant });
    },
    success(description: string, title = "Thành công") {
      addToast({ title, description, variant: "success" });
    },
    warning(description: string, title = "Cảnh báo") {
      addToast({ title, description, variant: "warning" });
    },
    failure(description: string, title = "Lỗi") {
      addToast({ title, description, variant: "error" });
    },
    error(error: Error, title = "Lỗi") {
      addToast({
        title,
        description: error.message,
        variant: "error",
      });
    },
  };
}
