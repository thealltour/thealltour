"use client";
import AdminButton from "@/components/admin/ui/AdminButton";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  value: string;
  disabled?: boolean;
  title?: string;
};

/**
 * Falls back to a hidden textarea + execCommand because the admin console is
 * reachable over plain HTTP on the LAN, where navigator.clipboard is undefined.
 */
async function writeToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function CopyToClipboardButton({ label, value, disabled, title }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    const ok = await writeToClipboard(value);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  }, [value]);

  const empty = !value.trim();

  return (
    <AdminButton variant="secondary"
      type="button"
      disabled={disabled || empty}
      onClick={() => void copy()}
      title={title ?? label}
      aria-live="polite"
      size="sm"
    >
      {state === "copied" ? `${label} 복사됨` : state === "failed" ? `${label} 복사 실패` : `${label} 복사`}
    </AdminButton>
  );
}
