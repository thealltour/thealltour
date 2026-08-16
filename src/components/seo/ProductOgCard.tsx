/**
 * 상품 상세 OG 전용 카드 (next/og / Satori).
 */

import {
  OG_ACCENT_SOFT,
  OG_MUTED,
  OG_PRIMARY,
  OG_TEXT,
  OgCardShell,
  ogClipOneLine,
  ogSplitTitle,
} from "@/components/seo/ogCardShared";

export type ProductOgCardProps = {
  productTitle: string;
  regionLine?: string | null;
  themeLine?: string | null;
  summaryLine?: string | null;
  priceLabel?: string | null;
  logoDataUrl?: string | null;
  heroImageDataUrl?: string | null;
};

function pickMetaLines(
  regionLine: string | null | undefined,
  themeLine: string | null | undefined,
  summaryLine: string | null | undefined,
): { eyebrow: string | null; detail: string | null } {
  const region = regionLine?.trim() || null;
  const theme = themeLine?.trim() || null;
  const summary = summaryLine?.trim() || null;

  if (region) {
    const detail = theme || summary || null;
    return { eyebrow: region, detail: detail ? ogClipOneLine(detail, 72) : null };
  }
  if (theme) {
    const detail = summary ? ogClipOneLine(summary, 72) : null;
    return { eyebrow: theme, detail };
  }
  if (summary) return { eyebrow: null, detail: ogClipOneLine(summary, 72) };
  return { eyebrow: null, detail: null };
}

type ContentBlockProps = {
  productTitle: string;
  eyebrow: string | null;
  detail: string | null;
  priceLabel: string | null;
};

function ProductContentBlock({ productTitle, eyebrow, detail, priceLabel }: ContentBlockProps) {
  const { line1, line2 } = ogSplitTitle(productTitle);
  const priceText = priceLabel?.trim() || null;
  const showConsultBadge = !priceText;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-end",
        maxWidth: 640,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: OG_PRIMARY,
            letterSpacing: "0.02em",
            marginBottom: 12,
          }}
        >
          {ogClipOneLine(eyebrow, 56)}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: detail ? 10 : priceText || showConsultBadge ? 14 : 0,
        }}
      >
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
            marginBottom: priceText || showConsultBadge ? 16 : 0,
          }}
        >
          {detail}
        </div>
      ) : null}

      {priceText ? (
        <div
          style={{
            alignSelf: "flex-start",
            marginTop: detail ? 0 : 4,
            padding: "10px 20px",
            borderRadius: 10,
            background: "#fff1e8",
            border: "1px solid #f6c8ad",
            fontSize: 24,
            fontWeight: 700,
            color: OG_ACCENT_SOFT,
            letterSpacing: "-0.02em",
          }}
        >
          {priceText}
        </div>
      ) : showConsultBadge ? (
        <div
          style={{
            alignSelf: "flex-start",
            marginTop: detail ? 0 : 4,
            padding: "8px 18px",
            borderRadius: 10,
            background: "#edf6fb",
            border: "1px solid #cddfea",
            fontSize: 19,
            fontWeight: 600,
            color: OG_PRIMARY,
            letterSpacing: "-0.01em",
          }}
        >
          맞춤 견적 · 상담
        </div>
      ) : null}
    </div>
  );
}

export function ProductOgCard(props: ProductOgCardProps) {
  const { productTitle, regionLine, themeLine, summaryLine, priceLabel, logoDataUrl, heroImageDataUrl } =
    props;
  const { eyebrow, detail } = pickMetaLines(regionLine, themeLine, summaryLine);
  const safeTitle = productTitle?.trim() || "여행 상품";

  return (
    <OgCardShell logoDataUrl={logoDataUrl} heroImageDataUrl={heroImageDataUrl}>
      <ProductContentBlock
        productTitle={safeTitle}
        eyebrow={eyebrow}
        detail={detail}
        priceLabel={priceLabel ?? null}
      />
    </OgCardShell>
  );
}
