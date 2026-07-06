"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "warning";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type SiteToastContextValue = {
  showToast: (kind: ToastKind, message: string) => void;
};

const SiteToastContext = createContext<SiteToastContextValue | undefined>(undefined);

const FALLBACK_TOAST_CONTEXT: SiteToastContextValue = {
  showToast: () => {},
};

export function useSiteToast(): SiteToastContextValue {
  const value = useContext(SiteToastContext);
  if (!value) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("useSiteToast called without SiteToastProvider. Falling back to no-op.");
    }
    return FALLBACK_TOAST_CONTEXT;
  }
  return value;
}

type SiteToastProviderProps = {
  children: ReactNode;
};

export default function SiteToastProvider({ children }: SiteToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToasts((prev) => {
      const next: Toast = { id: Date.now(), kind, message };
      return [...prev, next].slice(-4);
    });
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3200);
  }, []);

  return (
    <SiteToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[70] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.kind === "success"
                ? "bg-emerald-600"
                : toast.kind === "warning"
                  ? "bg-[var(--warning)]"
                  : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </SiteToastContext.Provider>
  );
}
