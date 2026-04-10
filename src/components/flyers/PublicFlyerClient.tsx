"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlyerLongformPreview } from "@/components/admin/products/modals/FlyerLongformPreview";
import { exportFlyerLongformDraftToPng } from "@/lib/flyers/exportFlyerLongformClone";
import { sanitizeFlyerPngFileName } from "@/lib/flyers/exportFlyerToPng";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import type { PublicFlyerApiError, PublicFlyerApiSuccess } from "@/lib/flyers/publicFlyer";
import { flyerTemplateLabel } from "@/components/admin/products/modals/flyerTemplates";

type PublicFlyerClientProps = {
  slug: string;
};

export default function PublicFlyerClient({ slug }: PublicFlyerClientProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FlyerDraftState | null>(null);
  const [displayTitle, setDisplayTitle] = useState("유인물");
  const [pngPending, setPngPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/flyers/${encodeURIComponent(slug.trim())}`);
        const json = (await res.json()) as PublicFlyerApiSuccess | PublicFlyerApiError;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError("message" in json ? json.message : "불러올 수 없습니다.");
          setDraft(null);
          return;
        }
        setDraft(json.draft);
        setDisplayTitle(json.displayTitle);
      } catch {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handlePrint = useCallback(() => {
    document.body.classList.add("print-flyer-only");
    const cleanup = () => document.body.classList.remove("print-flyer-only");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 120_000);
    window.print();
  }, []);

  const handlePng = useCallback(async () => {
    if (!draft) return;
    setPngPending(true);
    try {
      const name = sanitizeFlyerPngFileName(draft.fields.title || displayTitle || "flyer");
      await exportFlyerLongformDraftToPng(draft, name, null);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "PNG 저장에 실패했습니다.";
      window.alert(msg);
    } finally {
      setPngPending(false);
    }
  }, [draft, displayTitle]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--bg)] text-sm text-[var(--text-muted)]">
        불러오는 중…
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-[var(--bg)] px-4">
        <p className="text-center text-sm text-[var(--danger)]">{error ?? "유인물이 없습니다."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <header className="flyer-public-toolbar sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 px-3 py-3 shadow-sm backdrop-blur-sm print:hidden sm:px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">THE ALL TOUR</p>
            <h1 className="mt-0.5 truncate text-base font-bold text-[var(--text-primary)]">{displayTitle}</h1>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">템플릿: {flyerTemplateLabel(draft.templateKey)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              인쇄
            </button>
            <button
              type="button"
              disabled={pngPending}
              onClick={() => void handlePng()}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-50"
            >
              {pngPending ? "PNG…" : "PNG 저장"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-2 py-4 sm:px-4 sm:py-8 print:max-w-none print:px-0 print:py-0">
        <FlyerLongformPreview ref={previewRef} draft={draft} product={null} className="w-full" />
      </main>
    </div>
  );
}
