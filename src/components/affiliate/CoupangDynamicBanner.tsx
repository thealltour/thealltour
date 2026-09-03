"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  COUPANG_BANNER_HEIGHT,
  COUPANG_BANNER_WIDTH,
  COUPANG_GJS_URL,
  getCoupangBannerConfig,
  getCoupangWidgetIframeSrc,
} from "@/lib/affiliate/coupangBannerConfig";

declare global {
  interface Window {
    PartnersCoupang?: {
      G: new (config: ReturnType<typeof getCoupangBannerConfig>) => unknown;
    };
  }
}

const READY_FALLBACK_MS = 2500;

let gJsLoadPromise: Promise<void> | null = null;

function loadCoupangGJs(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.PartnersCoupang?.G) return Promise.resolve();

  if (gJsLoadPromise) return gJsLoadPromise;

  gJsLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${COUPANG_GJS_URL}"]`,
    );
    if (existing) {
      if (window.PartnersCoupang?.G) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Coupang g.js load failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = COUPANG_GJS_URL;
    script.async = true;
    script.dataset.coupangPartners = "gjs";
    script.onload = () => resolve();
    script.onerror = () => {
      gJsLoadPromise = null;
      reject(new Error("Coupang g.js load failed"));
    };
    document.head.appendChild(script);
  });

  return gJsLoadPromise;
}

function mountHasVisibleBanner(mount: HTMLElement): boolean {
  const iframe = mount.querySelector("iframe");
  if (!iframe) return false;
  const width = iframe.width ? Number(iframe.width) : iframe.clientWidth;
  const height = iframe.height ? Number(iframe.height) : iframe.clientHeight;
  return width > 0 && height > 0;
}

export type CoupangDynamicBannerProps = {
  className?: string;
  bannerId: number;
};

/**
 * Coupang Partners dynamic carousel banner (680×140).
 * g.js + container mount; widgets.html iframe 폴백.
 */
export function CoupangDynamicBanner({ className, bannerId }: CoupangDynamicBannerProps) {
  const instanceId = `coupang-banner-${bannerId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const initGenRef = useRef(0);
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  /** 제3자 위젯은 클라이언트 마운트 후에만 삽입 — SSR useId/DOM 불일치 방지 */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const w = container.clientWidth;
      if (!w) return;
      setScale(w / COUPANG_BANNER_WIDTH);
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!mounted || useIframeFallback) return;

    const mount = mountRef.current;
    if (!mount) return;

    const gen = ++initGenRef.current;
    let cancelled = false;
    let readyTimeout: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const markReady = () => {
      if (cancelled || gen !== initGenRef.current) return;
      setStatus("ready");
    };

    const activateIframeFallback = () => {
      if (cancelled || gen !== initGenRef.current) return;
      setUseIframeFallback(true);
      setStatus("ready");
    };

    const watchForIframe = () => {
      if (mountHasVisibleBanner(mount)) {
        markReady();
        return;
      }

      observer = new MutationObserver(() => {
        if (mountHasVisibleBanner(mount)) {
          observer?.disconnect();
          observer = null;
          markReady();
        }
      });
      observer.observe(mount, { childList: true, subtree: true, attributes: true });
    };

    setStatus("loading");
    mount.replaceChildren();

    loadCoupangGJs()
      .then(() => {
        if (cancelled || gen !== initGenRef.current) return;
        const G = window.PartnersCoupang?.G;
        if (!G) {
          activateIframeFallback();
          return;
        }

        mount.replaceChildren();
        new G({
          ...getCoupangBannerConfig(bannerId),
          container: mount,
          onLoaded: (hasAd) => {
            if (cancelled || gen !== initGenRef.current) return;
            if (hasAd) {
              markReady();
            }
          },
        });

        watchForIframe();
        readyTimeout = setTimeout(() => {
          if (mountHasVisibleBanner(mount)) {
            markReady();
            return;
          }
          activateIframeFallback();
        }, READY_FALLBACK_MS);
      })
      .catch(() => {
        activateIframeFallback();
      });

    return () => {
      cancelled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
      observer?.disconnect();
      mount.replaceChildren();
    };
  }, [mounted, instanceId, useIframeFallback, bannerId]);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden aspect-[680/140]", className)}
      aria-busy={status === "loading"}
      data-coupang-banner-status={status}
    >
      {status === "loading" || !mounted ? (
        <div
          className="absolute inset-0 z-0 bg-[var(--surface-muted)]"
          aria-hidden
        />
      ) : null}

      {!mounted ? null : useIframeFallback ? (
        <iframe
          title="쿠팡 파트너스 여행상품"
          src={getCoupangWidgetIframeSrc(bannerId)}
          width={COUPANG_BANNER_WIDTH}
          height={COUPANG_BANNER_HEIGHT}
          scrolling="no"
          frameBorder={0}
          referrerPolicy="unsafe-url"
          className="absolute inset-0 z-10 h-full w-full border-0"
        />
      ) : (
        <div
          ref={mountRef}
          id={instanceId}
          data-coupang-banner-id={bannerId}
          data-coupang-banner-mount=""
          className="absolute top-0 left-0 z-10 origin-top-left [&_ins]:!block [&_iframe]:!block"
          style={{
            width: COUPANG_BANNER_WIDTH,
            height: COUPANG_BANNER_HEIGHT,
            transform: `scale(${scale})`,
          }}
        />
      )}

      {status === "error" ? (
        <p className="sr-only">쿠팡 제휴 배너를 불러오지 못했습니다.</p>
      ) : null}
    </div>
  );
}
