import { toast } from "sonner";

// Use crypto.randomUUID() for truly unique IDs
const generateId = () => crypto.randomUUID();

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