"use client";

export type ToastVariant = "success" | "error" | "info";

export interface ToastPayload {
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export const APP_TOAST_EVENT = "kleacore:toast";

function emitToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(APP_TOAST_EVENT, { detail: payload }));
}

export const toast = {
  success(message: string, title?: string, duration = 3500) {
    emitToast({ message, title, duration, variant: "success" });
  },
  error(message: string, title?: string, duration = 4500) {
    emitToast({ message, title, duration, variant: "error" });
  },
  info(message: string, title?: string, duration = 3500) {
    emitToast({ message, title, duration, variant: "info" });
  },
};

