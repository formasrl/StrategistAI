import { toast } from "sonner";

// Use crypto.randomUUID() for unique IDs
const generateId = () => crypto.randomUUID();

export const showSuccess = (message: string) => {
  const toastId = generateId();
  toast.success(message, {
    id: toastId,
    dismissible: true, // built-in click to close
    className: "cursor-pointer active:scale-95 transition-transform",
    duration: 4000,
  });
};

export const showError = (message: string) => {
  const toastId = generateId();
  toast.error(message, {
    id: toastId,
    dismissible: true, // built-in click to close
    className: "cursor-pointer active:scale-95 transition-transform",
    duration: 5000,
  });
};

export const showLoading = (message: string) => {
  // For loading we usually let the caller decide when to dismiss
  const toastId = generateId();
  toast.loading(message, { id: toastId });
  return toastId;
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};