/**
 * 목적지·테마 랜딩 공통 OG 카드 (타입만 구분).
 */

import {
  OG_MUTED,
  OG_PRIMARY,
  OG_TEXT,
  OgCardShell,
  ogClipOneLine,
  ogSplitTitle,
} from "@/components/seo/ogCardShared";

export type TaxonomyOgCardProps = {
  variant: "destination" | "theme" | "recommended";
  title: string;
  descriptionLine?: string | null;
  logoDataUrl?: string | null;
  heroImageDataUrl?: string | null;
  /** undefined: 기본 "상품 둘러보기", null: 하단 배지 숨김 */
  footerCtaLabel?: string | null;
};

const EYEBROW: Record<TaxonomyOgCardProps["variant"], string> = {
  destination: "여행지",
  theme: "테마",
  recommended: "추천 여행",
};

export function TaxonomyOgCard({
  variant,
  title,
  descriptionLine,
  logoDataUrl,
  heroImageDataUrl,
  footerCtaLabel,
}: TaxonomyOgCardProps) {
  const titleFallback =
    variant === "destination" ? "여행지" : variant === "theme" ? "테마" : "추천 여행";
  const { line1, line2 } = ogSplitTitle(title?.trim() || titleFallback);
  const footerLabel = footerCtaLabel === null ? null : (footerCtaLabel ?? "상품 둘러보기");
  const detail = descriptionLine?.trim() ? ogClipOneLine(descriptionLine.trim(), 80) : null;

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
          {EYEBROW[variant]}
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

        {footerLabel ? (
          <div
            style={{
              alignSelf: "flex-start",
              marginTop: 18,
              padding: "8px 18px",
              borderRadius: 10,
              background: "#edf6fb",
              border: "1px solid #cddfea",
              fontSize: 18,
              fontWeight: 600,
              color: OG_PRIMARY,
            }}
          >
            {footerLabel}
          </div>
        ) : null}
      </div>
    </OgCardShell>
  );
}
