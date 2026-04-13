/**
 * 가이드 상세 OG 카드 — ProductOgCard와 동일 셸, 강조 필드만 가이드에 맞게.
 */

import {
  OG_MUTED,
  OG_TEXT,
  OgCardShell,
  ogClipOneLine,
  ogSplitTitle,
} from "@/components/seo/ogCardShared";

export type GuideOgCardProps = {
  title: string;
  categoryLabel?: string | null;
  contextLine?: string | null;
  logoDataUrl?: string | null;
  heroImageDataUrl?: string | null;
};

export function GuideOgCard({
  title,
  categoryLabel,
  contextLine,
  logoDataUrl,
  heroImageDataUrl,
}: GuideOgCardProps) {
  const hasHero = Boolean(heroImageDataUrl?.trim());
  const eyebrow = categoryLabel?.trim() || "여행 가이드";
  const detail = contextLine?.trim() ? ogClipOneLine(contextLine.trim(), 76) : null;
  const { line1, line2 } = ogSplitTitle(title?.trim() || "여행 가이드");

  return (
    <OgCardShell logoDataUrl={logoDataUrl} heroImageDataUrl={heroImageDataUrl}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-end",
          maxWidth: hasHero ? 920 : 980,
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 600,
            color: hasHero ? "rgba(226, 232, 240, 0.9)" : OG_MUTED,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            marginBottom: 12,
            textShadow: hasHero ? "0 1px 12px rgba(0,0,0,0.65)" : undefined,
          }}
        >
          {ogClipOneLine(eyebrow, 48)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: detail ? 12 : 0 }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: OG_TEXT,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              textShadow: hasHero ? "0 2px 24px rgba(0,0,0,0.55)" : undefined,
            }}
          >
            {line1}
          </div>
          {line2 ? (
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: OG_TEXT,
                lineHeight: 1.12,
                letterSpacing: "-0.03em",
                marginTop: 4,
                textShadow: hasHero ? "0 2px 24px rgba(0,0,0,0.55)" : undefined,
              }}
            >
              {line2}
            </div>
          ) : null}
        </div>

        {detail ? (
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: hasHero ? "rgba(203, 213, 225, 0.95)" : OG_MUTED,
              lineHeight: 1.35,
              textShadow: hasHero ? "0 1px 14px rgba(0,0,0,0.6)" : undefined,
            }}
          >
            {detail}
          </div>
        ) : null}
      </div>
    </OgCardShell>
  );
}
