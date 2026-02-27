"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "warning";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  showToast: (kind: ToastKind, message: string) => void;
};

const AdminToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useAdminToast(): ToastContextValue {
  const value = useContext(AdminToastContext);
  if (!value) {
    throw new Error("useAdminToast must be used within AdminToastProvider");
  }
  return value;
}

type AdminToastProviderProps = {
  children: ReactNode;
};

export default function AdminToastProvider({ children }: AdminToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToasts((prev) => {
      const next: Toast = { id: Date.now(), kind, message };
      return [...prev, next].slice(-4);
    });
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 2600);
  }, []);

  return (
    <AdminToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.kind === "success"
                ? "bg-[var(--success)]"
                : toast.kind === "warning"
                ? "bg-[var(--warning)]"
                : "bg-[var(--danger)]"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}

