"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Briefcase, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { PlannerPreparationHubContent } from "@/components/planner/PlannerPreparationHubContent";
import {
  buildPreparationHubSummaryLabel,
  hasPreparationHubContent,
} from "@/lib/affiliate/planner/preparationHub";
import type { PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";
import { restoreFocus, trapOverlayTabKey } from "@/lib/a11y/overlayFocus";
import { cn } from "@/lib/cn";

export type PlannerPreparationHubProps = {
  offers: PlannerAffiliateOffersDto;
  sessionId: string;
  sourceProductId: string | null;
  originText?: string | null;
  destinationName: string;
  startDate: string | null;
  endDate: string | null;
};

function useIsLgUp(): boolean {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isLg;
}

/**
 * Single entry for Planner affiliate commerce (PR-9AS).
 * Mobile: fixed sticky CTA + bottom sheet. Desktop (lg+): trigger + right drawer.
 * Affiliate cards / discovery widgets mount only while open (impression contract).
 * Exactly one surface mounts content at a time (no double impression).
 */
export function PlannerPreparationHub({
  offers,
  sessionId,
  sourceProductId,
  originText,
  destinationName,
  startDate,
  endDate,
}: PlannerPreparationHubProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const impressedTokensRef = useRef(new Set<string>());
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerDialogRef = useRef<HTMLElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const isLgUp = useIsLgUp();
  const summaryLabel = buildPreparationHubSummaryLabel(offers);
  const visible = hasPreparationHubContent(offers);

  const close = useCallback(() => setOpen(false), []);
  const openHub = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /** Desktop drawer: initial focus, Tab trap, restore (Modal / overlayFocus pattern). */
  useEffect(() => {
    if (!open || !isLgUp) return;

    previousFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const triggerFallback = desktopTriggerRef.current;

    const frame = requestAnimationFrame(() => {
      drawerCloseButtonRef.current?.focus();
    });

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      const root = drawerDialogRef.current;
      if (root) trapOverlayTabKey(event, root);
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKey);
      restoreFocus(previousFocusedElementRef.current ?? triggerFallback);
    };
  }, [open, isLgUp, close]);

  /** Mobile sheet: Escape only — native <dialog> focus behavior left intact. */
  useEffect(() => {
    if (!open || isLgUp) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isLgUp, close]);

  useEffect(() => {
    if (!visible) return;
    const updateViewportOffset = () => {
      if (typeof window === "undefined") return;
      const vv = window.visualViewport;
      if (!vv) {
        document.documentElement.style.setProperty("--planner-hub-cta-viewport-offset", "0px");
        return;
      }
      const viewportBottom = vv.offsetTop + vv.height;
      const gap = window.innerHeight - viewportBottom;
      document.documentElement.style.setProperty(
        "--planner-hub-cta-viewport-offset",
        `${Math.max(0, gap)}px`,
      );
    };
    updateViewportOffset();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateViewportOffset);
    vv?.addEventListener("scroll", updateViewportOffset);
    window.addEventListener("resize", updateViewportOffset);
    window.addEventListener("orientationchange", updateViewportOffset);
    return () => {
      vv?.removeEventListener("resize", updateViewportOffset);
      vv?.removeEventListener("scroll", updateViewportOffset);
      window.removeEventListener("resize", updateViewportOffset);
      window.removeEventListener("orientationchange", updateViewportOffset);
      document.documentElement.style.setProperty("--planner-hub-cta-viewport-offset", "0px");
    };
  }, [visible]);

  if (!visible) return null;

  const panelContent = open ? (
    <PlannerPreparationHubContent
      offers={offers}
      sessionId={sessionId}
      sourceProductId={sourceProductId}
      originText={originText}
      destinationName={destinationName}
      startDate={startDate}
      endDate={endDate}
      impressedTokensRef={impressedTokensRef}
      mountDiscovery={true}
    />
  ) : null;

  return (
    <div data-testid="planner-preparation-hub">
      <div className="hidden lg:block" data-testid="planner-preparation-hub-desktop-trigger">
        <button
          ref={desktopTriggerRef}
          type="button"
          onClick={openHub}
          className={buttonVariants({
            variant: "primary",
            size: "lg",
            className: "w-full gap-2",
          })}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Briefcase className="h-4 w-4 shrink-0" aria-hidden={true} />
          여행 준비하기
        </button>
        <p className="mt-1.5 text-center type-caption text-[var(--text-muted)]">{summaryLabel}</p>
      </div>

      <div
        role="banner"
        aria-label="여행 준비하기"
        data-testid="planner-preparation-hub-mobile-cta"
        className="fixed left-0 right-0 z-50 box-border w-full border-t border-[var(--divider)] glass-chrome glass-chrome-bottom lg:hidden"
        style={{
          bottom: "var(--planner-hub-cta-viewport-offset, 0px)",
          paddingTop: "12px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
        }}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5">
          <p className="type-caption text-center text-[var(--text-muted)]">{summaryLabel}</p>
          <button
            type="button"
            onClick={openHub}
            className={buttonVariants({
              variant: "primary",
              size: "lg",
              className: "min-h-12 w-full gap-2",
            })}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Briefcase className="h-4 w-4 shrink-0" aria-hidden={true} />
            여행 준비하기
          </button>
        </div>
      </div>

      {typeof document !== "undefined" && open && panelContent
        ? createPortal(
            isLgUp ? (
              <div
                className="fixed inset-0 z-[65]"
                data-testid="planner-preparation-hub-drawer"
                role="presentation"
              >
                <button
                  type="button"
                  aria-label="여행 준비 닫기"
                  className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[1px]"
                  onClick={close}
                />
                <aside
                  ref={drawerDialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex w-[min(440px,100vw)] flex-col bg-[var(--surface)] shadow-[-8px_0_24px_rgba(15,23,42,0.12)]"
                >
                  <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
                    <h2 id={titleId} className="type-body font-semibold text-[var(--foreground)]">
                      여행 준비하기
                    </h2>
                    <button
                      ref={drawerCloseButtonRef}
                      type="button"
                      onClick={close}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                      aria-label="닫기"
                    >
                      <X className="h-4 w-4" aria-hidden={true} />
                    </button>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                    {panelContent}
                  </div>
                </aside>
              </div>
            ) : (
              <dialog
                open
                aria-labelledby={titleId}
                data-testid="planner-preparation-hub-sheet"
                className={cn(
                  "fixed inset-0 z-[65] m-0 h-[100dvh] max-h-[100dvh] w-full max-w-none",
                  "overflow-hidden bg-transparent p-0 backdrop:bg-[var(--overlay)]",
                )}
                onCancel={(event) => {
                  event.preventDefault();
                  close();
                }}
              >
                <div className="flex h-full flex-col justify-end" onClick={close}>
                  <div
                    className="flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-[0_-8px_24px_rgba(15,23,42,0.12)]"
                    style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                    onClick={(event) => event.stopPropagation()}
                    role="document"
                  >
                    <header className="sticky top-0 z-[1] flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                      <h2 id={titleId} className="type-body font-semibold text-[var(--foreground)]">
                        여행 준비하기
                      </h2>
                      <button
                        type="button"
                        onClick={close}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        aria-label="닫기"
                      >
                        <X className="h-4 w-4" aria-hidden={true} />
                      </button>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                      {panelContent}
                    </div>
                  </div>
                </div>
              </dialog>
            ),
            document.body,
          )
        : null}
    </div>
  );
}
