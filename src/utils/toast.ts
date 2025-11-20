import { toast } from "sonner";

const generateId = () => Math.random().toString(36).substring(2, 9);

export const showSuccess = (message: string) => {
  const toastId = generateId();
  toast.success(message, {
    id: toastId,
    onClick: () => toast.dismiss(toastId),
    className: "cursor-pointer active:scale-95 transition-transform",
    duration: 4000,
  });
};

export const showError = (message: string) => {
  const toastId = generateId();
  toast.error(message, {
    id: toastId,
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