"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const AdminConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function useAdminConfirm(): ConfirmContextValue {
  const value = useContext(AdminConfirmContext);
  if (!value) {
    return {
      confirm: async (options: ConfirmOptions) => {
        if (typeof window === "undefined") return false;
        const message = options.description
          ? `${options.title}\n\n${options.description}`
          : options.title;
        return window.confirm(message);
      },
    };
  }
  return value;
}

type PendingState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type AdminConfirmProviderProps = {
  children: ReactNode;
};

export default function AdminConfirmProvider({ children }: AdminConfirmProviderProps) {
  const [pending, setPending] = useState<PendingState | null>(null);

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setPending({
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? "확인",
        cancelLabel: options.cancelLabel ?? "취소",
        resolve,
      });
    });
  }

  function handleClose(result: boolean) {
    if (!pending) return;
    pending.resolve(result);
    setPending(null);
  }

  return (
    <AdminConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-5 shadow-[0_18px_55px_rgba(15,23,42,0.45)] ring-1 ring-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text)]">{pending.title}</h2>
            {pending.description ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">{pending.description}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="btn-admin-secondary px-3 py-1.5 text-xs font-medium"
              >
                {pending.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className="btn-admin-primary px-3 py-1.5 text-xs font-medium"
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminConfirmContext.Provider>
  );
}

