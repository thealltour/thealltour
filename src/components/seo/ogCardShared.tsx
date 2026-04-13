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

export function OgBrandChip({ logoDataUrl }: { logoDataUrl?: string | null }) {
  return (
    <div
      style={{
        position: "absolute",
        top: OG_PAD_Y,
        left: OG_PAD_X,
        zIndex: 4,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "8px 16px 8px 12px",
        borderRadius: 999,
        background: "rgba(15, 23, 42, 0.78)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
      }}
    >
      {logoDataUrl ? (
        <img
          src={logoDataUrl}
          alt=""
          height={26}
          width={26}
          style={{
            height: 26,
            width: 26,
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
      ) : null}
      <span
        style={{
          marginLeft: logoDataUrl ? 10 : 0,
          fontSize: 18,
          fontWeight: 700,
          color: OG_TEXT,
          letterSpacing: "-0.02em",
        }}
      >
        더올투어
      </span>
    </div>
  );
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
          opacity: hasHero ? 0.85 : 1,
        }}
      />

      {hasHero ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.06) 0%, rgba(15,23,42,0) 38%, rgba(11,18,32,0.25) 58%, rgba(11,18,32,0.82) 82%, rgba(8,12,22,0.94) 100%)",
          }}
        />
      ) : null}

      <OgBrandChip logoDataUrl={logoDataUrl} />

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
