/**
 * OG 카드(next/og) 공통 레이아웃·토큰. Product/Guide/Taxonomy 카드가 동일 브랜드 톤을 유지하도록 공유.
 */

import type { ReactNode } from "react";

export const OG_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif';
export const OG_TEXT = "#f8fafc";
export const OG_MUTED = "#94a3b8";
export const OG_ACCENT_SOFT = "#fdba74";

export const OG_PAD_X = 64;
export const OG_PAD_Y = 52;

export const OG_WORDMARK_HEIGHT = 40;

export const OG_FALLBACK_PANEL_BG =
  "linear-gradient(165deg, #0b1220 0%, #0f172a 42%, #1e293b 88%, #0f172a 100%)";

export function ogClipOneLine(s: string, max = 88): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Satori용 대략 2줄 타이틀 분할 */
export function ogSplitTitle(title: string, max1 = 19, max2 = 21): { line1: string; line2: string | null } {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return { line1: "더올투어", line2: null };
  if (t.length <= max1) return { line1: t, line2: null };

  let breakAt = max1;
  const slice = t.slice(0, max1);
  const spaceIdx = slice.lastIndexOf(" ");
  if (spaceIdx >= Math.floor(max1 * 0.42)) breakAt = spaceIdx;

  const line1 = t.slice(0, breakAt).trim();
  let rest = t.slice(breakAt).trim();
  if (!rest) return { line1, line2: null };
  if (rest.length > max2) rest = `${rest.slice(0, max2 - 1)}…`;
  return { line1, line2: rest };
}

/** 좌상단 워드마크 헤더 (통일 OG 셸) */
export function OgWordmarkHeader({
  logoDataUrl,
  hasHero = false,
}: {
  logoDataUrl?: string | null;
  hasHero?: boolean;
}) {
  if (!logoDataUrl) {
    return (
      <div
        style={{
          position: "absolute",
          top: OG_PAD_Y,
          left: OG_PAD_X,
          zIndex: 4,
          fontSize: 22,
          fontWeight: 800,
          color: OG_TEXT,
          letterSpacing: "-0.02em",
          textShadow: hasHero ? "0 1px 14px rgba(0,0,0,0.55)" : undefined,
        }}
      >
        더올투어
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: OG_PAD_Y - 4,
        left: OG_PAD_X,
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        padding: hasHero ? "10px 14px" : "0",
        borderRadius: hasHero ? 12 : 0,
        background: hasHero ? "rgba(15, 23, 42, 0.55)" : "transparent",
        border: hasHero ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
      }}
    >
      <img
        src={logoDataUrl}
        alt=""
        height={OG_WORDMARK_HEIGHT}
        style={{
          height: OG_WORDMARK_HEIGHT,
          width: "auto",
          objectFit: "contain",
          display: "flex",
        }}
      />
    </div>
  );
}

/** @deprecated OgWordmarkHeader 사용 */
export function OgBrandChip({ logoDataUrl }: { logoDataUrl?: string | null }) {
  return <OgWordmarkHeader logoDataUrl={logoDataUrl} hasHero />;
}

type OgCardShellProps = {
  logoDataUrl?: string | null;
  heroImageDataUrl?: string | null;
  children: ReactNode;
};

export function OgCardShell({ logoDataUrl, heroImageDataUrl, children }: OgCardShellProps) {
  const hasHero = Boolean(heroImageDataUrl?.trim());

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontFamily: OG_FONT,
        background: "#0f172a",
        overflow: "hidden",
      }}
    >
      {hasHero ? (
        <img
          src={heroImageDataUrl!}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: OG_FALLBACK_PANEL_BG,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          zIndex: 3,
          background: "linear-gradient(90deg, #ea580c 0%, #fb923c 50%, #ea580c 100%)",
          opacity: hasHero ? 0.9 : 1,
        }}
      />

      {hasHero ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0.08) 32%, rgba(11,18,32,0.35) 58%, rgba(11,18,32,0.86) 82%, rgba(8,12,22,0.96) 100%)",
          }}
        />
      ) : null}

      <OgWordmarkHeader logoDataUrl={logoDataUrl} hasHero={hasHero} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: `${OG_PAD_Y}px ${OG_PAD_X}px ${OG_PAD_Y + 6}px`,
          minHeight: hasHero ? 280 : 320,
        }}
      >
        {children}
      </div>
    </div>
  );
}
