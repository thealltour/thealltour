/**
 * OG 카드(next/og) 공통 레이아웃·토큰. Product/Guide/Taxonomy 카드가 동일 브랜드 톤을 유지하도록 공유.
 */

import type { ReactNode } from "react";

export const OG_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif';
export const OG_TEXT = "#0c1929";
export const OG_MUTED = "#4b6474";
export const OG_ACCENT = "#e0612a";
export const OG_PRIMARY = "#1e5b8f";
export const OG_ACCENT_SOFT = "#b84d20";

export const OG_PAD_X = 40;
export const OG_PAD_Y = 36;
export const OG_SAFE_X = 120;

export const OG_WORDMARK_HEIGHT = 36;

export const OG_FALLBACK_PANEL_BG =
  "linear-gradient(135deg, #f8fbfe 0%, #eef6fb 45%, #fff4ed 100%)";

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

/** 밝은 정보 카드 안 워드마크 헤더 */
export function OgWordmarkHeader({
  logoDataUrl,
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
          fontSize: 21,
          fontWeight: 800,
          color: OG_TEXT,
          letterSpacing: "-0.02em",
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
        top: OG_PAD_Y - 2,
        left: OG_PAD_X,
        display: "flex",
        alignItems: "center",
      }}
    >
      <img
        src={logoDataUrl}
        alt=""
        width={200}
        height={OG_WORDMARK_HEIGHT}
        style={{
          height: OG_WORDMARK_HEIGHT,
          width: 200,
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
  const panelLeft = hasHero ? OG_SAFE_X : 140;
  const panelWidth = hasHero ? 720 : 920;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontFamily: OG_FONT,
        background: OG_FALLBACK_PANEL_BG,
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
            top: 0,
            right: 0,
            width: 780,
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

      {hasHero ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, #f3f7fb 0%, rgba(243,247,251,0.98) 25%, rgba(243,247,251,0.7) 52%, rgba(243,247,251,0.05) 78%)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          left: panelLeft,
          top: 68,
          width: panelWidth,
          height: 494,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: `${OG_PAD_Y + 46}px ${OG_PAD_X}px ${OG_PAD_Y}px`,
          borderRadius: 28,
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(230,232,238,0.96)",
          boxShadow: "0 22px 55px rgba(12,25,41,0.14)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 7,
            borderRadius: "28px 0 0 28px",
            background: `linear-gradient(180deg, ${OG_PRIMARY} 0%, ${OG_ACCENT} 100%)`,
          }}
        />
        <OgWordmarkHeader logoDataUrl={logoDataUrl} hasHero={false} />
        {children}
      </div>
    </div>
  );
}
