/**
 * next/og ImageResponse용 브랜드 OG 카드 JSX.
 * 인라인 스타일만 사용 (Satori 호환).
 * 홈·지역·테마·상품 fallback 등 공통 — 다크 셸 + 워드마크 통일.
 */

import { OG_FONT, OG_MUTED, OG_TEXT, OG_WORDMARK_HEIGHT } from "@/components/seo/ogCardShared";

export type BrandOgBackgroundVariant = "navy" | "navyWarm";

export type BrandOgCardProps = {
  /** 상단 작은 라벨 (예: REGION, THEME). 없으면 생략 */
  tagLabel?: string;
  /** @deprecated 워드마크 사용으로 미표시 */
  eyebrow?: string;
  /** @deprecated 워드마크 사용으로 미표시 */
  brandSubline?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  logoDataUrl?: string | null;
  backgroundVariant?: BrandOgBackgroundVariant;
  /** home | region | theme — 타이포 미세 조정용 (선택) */
  variant?: "home" | "region" | "theme";
};

const BG: Record<BrandOgBackgroundVariant, string> = {
  navy: "linear-gradient(145deg, #0b1220 0%, #0f172a 38%, #132337 100%)",
  navyWarm:
    "linear-gradient(145deg, #0b1220 0%, #0f172a 45%, #1a1f2e 70%, #1c1917 100%)",
};

const ACCENT = "#ea580c";

export function BrandOgCard({
  tagLabel,
  title,
  subtitle,
  badge,
  logoDataUrl,
  backgroundVariant = "navyWarm",
  variant = "home",
}: BrandOgCardProps) {
  const titleFontSize = variant === "home" ? 58 : 52;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG[backgroundVariant],
        position: "relative",
        fontFamily: OG_FONT,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${ACCENT} 0%, #fb923c 55%, ${ACCENT} 100%)`,
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "52px 64px 60px",
        }}
      >
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt=""
            height={OG_WORDMARK_HEIGHT + 4}
            style={{
              height: OG_WORDMARK_HEIGHT + 4,
              width: "auto",
              objectFit: "contain",
              marginBottom: 28,
              alignSelf: "flex-start",
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: OG_TEXT,
              letterSpacing: "-0.02em",
              marginBottom: 28,
            }}
          >
            더올투어
          </div>
        )}

        {tagLabel ? (
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: ACCENT,
              letterSpacing: "0.2em",
              textTransform: "uppercase" as const,
              marginBottom: 14,
            }}
          >
            {tagLabel}
          </div>
        ) : null}

        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 800,
            color: OG_TEXT,
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            maxWidth: 1000,
            marginBottom: subtitle ? 28 : 0,
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: OG_MUTED,
              lineHeight: 1.35,
              maxWidth: 920,
            }}
          >
            {subtitle}
          </div>
        ) : null}

        {badge ? (
          <div
            style={{
              marginTop: 36,
              alignSelf: "flex-start",
              padding: "10px 20px",
              borderRadius: 999,
              background: "rgba(234, 88, 12, 0.15)",
              border: "1px solid rgba(234, 88, 12, 0.45)",
              fontSize: 18,
              fontWeight: 600,
              color: "#fdba74",
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>
    </div>
  );
}
