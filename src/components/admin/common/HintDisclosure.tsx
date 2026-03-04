"use client";

import { useState, useId, useEffect } from "react";

const STORAGE_PREFIX = "admin.hintDisclosure.";

export type HintDisclosureProps = {
  /** localStorage key suffix (key = admin.hintDisclosure.{id}) */
  id: string;
  /** 한 줄 요약 (항상 표시) */
  summary: React.ReactNode;
  /** 펼쳤을 때 상세 내용 */
  children: React.ReactNode;
  /** 초기 펼침 여부 (localStorage 없을 때만 사용) */
  defaultOpen?: boolean;
};

function readStoredOpen(id: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // ignore
  }
  return defaultOpen;
}

function writeStoredOpen(id: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, open ? "1" : "0");
  } catch {
    // ignore
  }
}

export function HintDisclosure({
  id,
  summary,
  children,
  defaultOpen = false,
}: HintDisclosureProps) {
  const [open, setOpen] = useState<boolean>(() => readStoredOpen(id, defaultOpen));
  const contentId = useId().replace(/:/g, "-");
  const buttonId = useId().replace(/:/g, "-");

  useEffect(() => {
    writeStoredOpen(id, open);
  }, [id, open]);

  const toggle = () => setOpen((prev) => !prev);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50">
      <div className="flex items-start justify-between gap-3 px-3 py-2">
        <div className="text-sm text-[var(--text-primary)]">{summary}</div>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
          className="flex h-10 min-h-[40px] w-10 min-w-[40px] shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
          title={open ? "도움말 접기" : "도움말 펼치기"}
        >
          i
        </button>
      </div>
      {open && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={buttonId}
          className="border-t border-[var(--border)] px-3 pb-3 pt-2 text-sm text-[var(--text-secondary)] whitespace-pre-wrap"
        >
          {children}
        </div>
      )}
    </div>
  );
}
