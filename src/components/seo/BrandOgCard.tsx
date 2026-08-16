/**
 * next/og ImageResponse용 브랜드 OG 카드 JSX.
 * 인라인 스타일만 사용 (Satori 호환).
 *
 * 페이지급 OG: 밝은 배경 + 흰 정보카드(좌측 액센트·소프트 섀도)
 * + 중앙 워드마크/라벨/타이틀/서브. 배경사진·쿠폰 플로트 없음.
 */

import {
  OG_ACCENT,
  OG_FONT,
  OG_MUTED,
  OG_PRIMARY,
  OG_TEXT,
  OG_WORDMARK_HEIGHT,
} from "@/components/seo/ogCardShared";

/** @deprecated 호환용. 실제로는 동일 밝은 배경 사용 */
export type BrandOgBackgroundVariant = "navy" | "navyWarm" | "light";

export type BrandOgCardProps = {
  /** 상단 작은 라벨 (예: PRODUCTS, KAKAO). 없으면 생략 */
  tagLabel?: string;
  /** @deprecated 워드마크 사용으로 미표시 */
  eyebrow?: string;
  /** @deprecated 워드마크 사용으로 미표시 */
  brandSubline?: string;
  title: string;
  subtitle?: string;
  /** 보조 한 줄 텍스트 (필/쿠폰 UI 아님) */
  badge?: string;
  logoDataUrl?: string | null;
  /** @deprecated 무시됨 — 항상 밝은 단색 톤 */
  backgroundVariant?: BrandOgBackgroundVariant;
  /** home | region | theme — 타이포 미세 조정용 (선택) */
  variant?: "home" | "region" | "theme";
};

export function BrandOgCard({
  tagLabel,
  title,
  subtitle,
  badge,
  logoDataUrl,
  variant = "home",
}: BrandOgCardProps) {
  const titleFontSize = variant === "home" ? 48 : 44;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f4f7fa",
        position: "relative",
        fontFamily: OG_FONT,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 68,
          width: 920,
          height: 494,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "42px 72px",
          textAlign: "center",
          borderRadius: 28,
          background: "#ffffff",
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

        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/og ImageResponse
          <img
            src={logoDataUrl}
            alt=""
            width={223}
            height={OG_WORDMARK_HEIGHT}
            style={{
              height: OG_WORDMARK_HEIGHT,
              width: 223,
              objectFit: "contain",
              marginBottom: 26,
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: OG_PRIMARY,
              letterSpacing: "-0.02em",
              marginBottom: 26,
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
              color: OG_ACCENT,
              letterSpacing: "0.16em",
              textTransform: "uppercase" as const,
              marginBottom: 12,
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
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            maxWidth: 880,
            marginBottom: subtitle || badge ? 18 : 0,
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: OG_MUTED,
              lineHeight: 1.4,
              maxWidth: 820,
              marginBottom: badge ? 14 : 0,
            }}
          >
            {subtitle}
          </div>
        ) : null}

        {badge ? (
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: OG_MUTED,
              lineHeight: 1.4,
              maxWidth: 800,
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>
    </div>
  );
}
