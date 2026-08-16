/**
 * 가이드 상세 OG 카드 — ProductOgCard와 동일 셸, 강조 필드만 가이드에 맞게.
 */

import {
  OG_MUTED,
  OG_PRIMARY,
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
          maxWidth: 640,
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 600,
            color: OG_PRIMARY,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            marginBottom: 12,
          }}
        >
          {ogClipOneLine(eyebrow, 48)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: detail ? 12 : 0 }}>
          <div
            style={{
              fontSize: 43,
              fontWeight: 800,
              color: OG_TEXT,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            {line1}
          </div>
          {line2 ? (
            <div
              style={{
                fontSize: 43,
                fontWeight: 800,
                color: OG_TEXT,
                lineHeight: 1.12,
                letterSpacing: "-0.03em",
                marginTop: 4,
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
              color: OG_MUTED,
              lineHeight: 1.35,
            }}
          >
            {detail}
          </div>
        ) : null}
      </div>
    </OgCardShell>
  );
}
