/**
 * next/og ImageResponse용 브랜드 OG 카드 JSX.
 * 인라인 스타일만 사용 (Satori 호환).
 * 카톡·메신저가 좌우를 자를 수 있어 핵심 카피는 중앙 세이프존에 둔다.
 */

import {
  OG_ACCENT,
  OG_FONT,
  OG_MUTED,
  OG_PRIMARY,
  OG_TEXT,
  OG_WORDMARK_HEIGHT,
} from "@/components/seo/ogCardShared";

export type BrandOgBackgroundVariant = "navy" | "navyWarm" | "light";

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
  /** 대표 사진 — 있으면 우측 사진 + 좌측 화이트 정보 카드 */
  heroImageDataUrl?: string | null;
  backgroundVariant?: BrandOgBackgroundVariant;
  /** home | region | theme — 타이포 미세 조정용 (선택) */
  variant?: "home" | "region" | "theme";
};

const BG: Record<BrandOgBackgroundVariant, string> = {
  navy: "linear-gradient(135deg, #f8fbfe 0%, #edf6fb 48%, #fff5ee 100%)",
  navyWarm: "linear-gradient(135deg, #f8fbfe 0%, #eef6fb 48%, #fff2e8 100%)",
  light: "linear-gradient(135deg, #f8fbfe 0%, #eef6fb 48%, #fff2e8 100%)",
};

export function BrandOgCard({
  tagLabel,
  title,
  subtitle,
  badge,
  logoDataUrl,
  heroImageDataUrl,
  backgroundVariant = "light",
  variant = "home",
}: BrandOgCardProps) {
  const titleFontSize = variant === "home" ? 48 : 44;
  const hasHero = Boolean(heroImageDataUrl?.trim());
  const cardWidth = hasHero ? 700 : 920;

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
            width: 760,
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
          }}
        />
      ) : null}

      {hasHero ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, #f3f7fb 0%, rgba(243,247,251,0.98) 25%, rgba(243,247,251,0.65) 52%, rgba(243,247,251,0.03) 80%)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${OG_PRIMARY} 0%, ${OG_PRIMARY} 62%, ${OG_ACCENT} 62%, ${OG_ACCENT} 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: hasHero ? 120 : 140,
          top: 68,
          width: cardWidth,
          height: 494,
          display: "flex",
          flexDirection: "column",
          alignItems: hasHero ? "flex-start" : "center",
          justifyContent: "center",
          padding: hasHero ? "42px 48px" : "42px 72px",
          textAlign: hasHero ? "left" : "center",
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
        {logoDataUrl ? (
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
            marginBottom: subtitle ? 18 : 0,
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
            }}
          >
            {subtitle}
          </div>
        ) : null}

        {badge ? (
          <div
            style={{
              marginTop: 28,
              padding: "10px 20px",
              borderRadius: 999,
              background: "#fff1e8",
              border: "1px solid #f6c8ad",
              fontSize: 18,
              fontWeight: 600,
              color: "#b84d20",
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>
    </div>
  );
}
