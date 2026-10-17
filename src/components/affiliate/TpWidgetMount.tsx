"use client";

import { useEffect, useRef, useState } from "react";
import { isTpWidgetSrc } from "@/lib/affiliate/planner/discovery/tpWidgetSrc";
import { cn } from "@/lib/cn";

export type TpWidgetStatus = "idle" | "loading" | "rendered" | "failed";

/** Start loading before the widget scrolls into view. */
const LAZY_ROOT_MARGIN = "400px 0px";
/** Script fetch budget; covers a hung request that never fires load/error. */
export const TP_WIDGET_LOAD_TIMEOUT_MS = 10_000;
/**
 * After the embed script loads, the provider iframe must appear within this window.
 * Tiqets chains a second loader (widgets.tiqets.com) before creating its iframe.
 */
export const TP_WIDGET_RENDER_TIMEOUT_MS = 8_000;

/** The embed inserts placeholder divs synchronously; only the provider iframe means rendered. */
export function tpWidgetHasRenderedContent(mount: HTMLElement): boolean {
  return mount.querySelector("iframe") != null;
}

type TpWidgetMountProps = {
  /** Stable identity of the widget content; a change tears down and re-creates the widget. */
  widgetKey: string;
  /** Embed URL from the tpWidgetSrc builders; anything else is never injected. */
  src: string;
  loadingText: string;
  onStatusChange?: (status: TpWidgetStatus) => void;
  className?: string;
};

/**
 * Travelpayouts tpwdgt embed: the script renders the widget next to its own <script> tag,
 * so the tag is appended inside this component's mount (never document.head).
 * Lazy (IntersectionObserver), one script per widgetKey, cleanup limited to the mount.
 */
export function TpWidgetMount({
  widgetKey,
  src,
  loadingText,
  onStatusChange,
  className,
}: TpWidgetMountProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const genRef = useRef(0);
  const onStatusChangeRef = useRef(onStatusChange);
  const [state, setState] = useState<{ key: string; status: TpWidgetStatus }>({
    key: widgetKey,
    status: "idle",
  });
  const status = state.key === widgetKey ? state.status : "idle";

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  useEffect(() => {
    const container = containerRef.current;
    const mount = mountRef.current;
    if (!container || !mount) return;

    const gen = ++genRef.current;
    let cancelled = false;
    let intersection: IntersectionObserver | null = null;
    let mutation: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let script: HTMLScriptElement | null = null;

    const isStale = () => cancelled || gen !== genRef.current;
    const settle = (next: TpWidgetStatus) => {
      if (isStale()) return;
      setState({ key: widgetKey, status: next });
    };
    const stopWatching = () => {
      mutation?.disconnect();
      mutation = null;
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const finish = (next: "rendered" | "failed") => {
      if (isStale()) return;
      stopWatching();
      settle(next);
    };

    const inject = () => {
      if (isStale()) return;
      if (!isTpWidgetSrc(src)) {
        settle("failed");
        return;
      }
      settle("loading");
      mount.replaceChildren();

      mutation = new MutationObserver(() => {
        if (tpWidgetHasRenderedContent(mount)) finish("rendered");
      });
      mutation.observe(mount, { childList: true, subtree: true });

      const el = document.createElement("script");
      el.async = true;
      el.charset = "utf-8";
      el.src = src;
      el.onload = () => {
        if (isStale()) return;
        if (tpWidgetHasRenderedContent(mount)) {
          finish("rendered");
          return;
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          finish(tpWidgetHasRenderedContent(mount) ? "rendered" : "failed");
        }, TP_WIDGET_RENDER_TIMEOUT_MS);
      };
      el.onerror = () => finish("failed");
      timer = setTimeout(() => finish("failed"), TP_WIDGET_LOAD_TIMEOUT_MS);
      script = el;
      mount.appendChild(el);
    };

    if (typeof IntersectionObserver === "undefined") {
      inject();
    } else {
      intersection = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          intersection?.disconnect();
          intersection = null;
          inject();
        },
        { rootMargin: LAZY_ROOT_MARGIN },
      );
      intersection.observe(container);
    }

    return () => {
      cancelled = true;
      intersection?.disconnect();
      stopWatching();
      if (script) {
        script.onload = null;
        script.onerror = null;
        script.remove();
      }
      mount.replaceChildren();
    };
  }, [widgetKey, src]);

  const pending = status === "idle" || status === "loading";

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className)}
      aria-busy={pending}
      data-tp-widget-key={widgetKey}
      data-tp-widget-status={status}
    >
      {pending ? (
        <p className="type-caption text-[var(--text-subtle)]" aria-hidden>
          {loadingText}
        </p>
      ) : null}
      <div
        ref={mountRef}
        className="w-full overflow-hidden [&_iframe]:max-w-full"
        data-tp-widget-mount=""
      />
    </div>
  );
}
