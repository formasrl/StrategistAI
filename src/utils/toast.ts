import { toast } from "sonner";

export const showSuccess = (message: string) => {
  const toastId = toast.success(message, {
    onClick: () => toast.dismiss(toastId),
    className: "cursor-pointer active:scale-95 transition-transform",
    duration: 4000,
  });
};

export const showError = (message: string) => {
  const toastId = toast.error(message, {
    onClick: () => toast.dismiss(toastId),
    className: "cursor-pointer active:scale-95 transition-transform",
    duration: 5000,
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};