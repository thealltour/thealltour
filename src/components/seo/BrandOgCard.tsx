/**
 * next/og ImageResponse용 브랜드 OG 카드 JSX.
 * 인라인 스타일만 사용 (Satori 호환).
 * 홈·지역·테마·상품 fallback 등 공통.
 */

export type BrandOgBackgroundVariant = "navy" | "navyWarm";

export type BrandOgCardProps = {
  /** 상단 작은 라벨 (예: REGION, THEME). 없으면 생략 */
  tagLabel?: string;
  /** 로고 옆 첫 줄 브랜드명 (기본: 더올투어) */
  eyebrow?: string;
  /** 로고 옆 둘째 줄 (기본: THEALL TOUR) */
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
const TEXT = "#f8fafc";
const MUTED = "#94a3b8";

export function BrandOgCard({
  tagLabel,
  eyebrow = "더올투어",
  brandSubline = "THEALL TOUR",
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
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${ACCENT} 0%, #fb923c 55%, ${ACCENT} 100%)`,
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px 72px 64px",
        }}
      >
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
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 36,
          }}
        >
          {logoDataUrl ? (
            <img
              src={logoDataUrl}
              alt=""
              height={44}
              style={{
                height: 44,
                width: "auto",
                objectFit: "contain",
                marginRight: 20,
              }}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: TEXT,
                letterSpacing: "-0.02em",
              }}
            >
              {eyebrow}
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: MUTED,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginTop: 4,
              }}
            >
              {brandSubline}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 800,
            color: TEXT,
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
              color: MUTED,
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
