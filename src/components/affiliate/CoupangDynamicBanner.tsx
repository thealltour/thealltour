"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  COUPANG_BANNER_HEIGHT,
  COUPANG_BANNER_WIDTH,
  COUPANG_GJS_URL,
  getCoupangBannerConfig,
} from "@/lib/affiliate/coupangBannerConfig";

declare global {
  interface Window {
    PartnersCoupang?: {
      G: new (config: {
        id: number;
        template: string;
        trackingCode: string;
        width: string;
        height: string;
        tsource: string;
      }) => unknown;
    };
  }
}

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

export type CoupangDynamicBannerProps = {
  className?: string;
};

/**
 * Coupang Partners dynamic carousel banner (680×140).
 * g.js single-load + per-instance init with cleanup on unmount.
 */
export function CoupangDynamicBanner({ className }: CoupangDynamicBannerProps) {
  const reactId = useId().replace(/:/g, "");
  const instanceId = `coupang-banner-${reactId}`;
  const outerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const initGenRef = useRef(0);
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const updateScale = () => {
      const w = outer.clientWidth;
      if (!w) return;
      setScale(Math.min(1, w / COUPANG_BANNER_WIDTH));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const gen = ++initGenRef.current;
    let cancelled = false;

    setStatus("loading");
    mount.replaceChildren();

    loadCoupangGJs()
      .then(() => {
        if (cancelled || gen !== initGenRef.current) return;
        const G = window.PartnersCoupang?.G;
        if (!G) {
          setStatus("error");
          return;
        }
        mount.replaceChildren();
        new G(getCoupangBannerConfig());
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled && gen === initGenRef.current) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      mount.replaceChildren();
    };
  }, [instanceId]);

  const scaledWidth = COUPANG_BANNER_WIDTH * scale;
  const scaledHeight = COUPANG_BANNER_HEIGHT * scale;

  return (
    <div
      ref={outerRef}
      className={cn("mx-auto w-full max-w-[680px] overflow-x-hidden", className)}
      aria-busy={status === "loading"}
    >
      <div
        className="relative mx-auto overflow-hidden"
        style={{ width: scaledWidth, height: scaledHeight, minHeight: scaledHeight }}
      >
        <div
          ref={mountRef}
          id={instanceId}
          data-coupang-banner-mount=""
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: COUPANG_BANNER_WIDTH,
            height: COUPANG_BANNER_HEIGHT,
            transform: `scale(${scale})`,
          }}
        />
        {status === "loading" ? (
          <div
            className="absolute inset-0 rounded-lg bg-[var(--surface-muted)] ring-1 ring-[var(--border)]/60"
            aria-hidden
          />
        ) : null}
        {status === "error" ? (
          <p className="sr-only">쿠팡 제휴 배너를 불러오지 못했습니다.</p>
        ) : null}
      </div>
    </div>
  );
}
