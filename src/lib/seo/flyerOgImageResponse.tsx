import { ImageResponse } from "next/og";
import { fetchPublicFlyerBySlug } from "@/lib/flyers/fetchPublicFlyerBySlug";
import { fetchOgImageAsDataUrl } from "@/lib/seo/fetchOgImageAsDataUrl";
import { isOgPromoSecondLine, splitFlyerOgTitleLines } from "@/lib/seo/flyerOgTitleLines";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

/** 히어로 높이 ≈ 캔버스의 35% — 텍스트 영역 확보 */
const HERO_H = 220;
const HERO_W = 1000;
const PAD_X = 44;
const TEXT_MAX_W = 840;

const BG =
  "linear-gradient(180deg, #f8fafc 0%, #ffffff 38%, #f1f5f9 100%)";
const INK = "#0f172a";
/** 서브텍스트 — 제목 대비 한 단계 낮춤 */
const SUBTITLE = "#94a3b8";
const PLACEHOLDER_BG = "#e2e8f0";
const PLACEHOLDER_TEXT = "#64748b";
/** BrandOgCard와 동일 계열 포인트 */
const ACCENT = "#ea580c";

/** 이미지 하단 → 본문으로 이어지는 화이트 페이드 */
const HERO_FADE_OVERLAY =
  "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 38%, rgba(255,255,255,0.88) 72%, rgba(255,255,255,0.97) 100%)";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** 공백이 있으면 첫 단어를 포인트 컬러로. 없으면 null → 액센트 바만 사용 */
function splitTitleLeadWord(title: string): { lead: string; rest: string } | null {
  const t = title.trim();
  const sp = t.indexOf(" ");
  if (sp <= 0 || sp >= t.length - 1) return null;
  return { lead: t.slice(0, sp), rest: t.slice(sp) };
}

/**
 * 공개 유인물 `/flyers/[slug]`용 Open Graph / Twitter 카드 ImageResponse.
 */
export async function getFlyerOpenGraphImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  let row: Awaited<ReturnType<typeof fetchPublicFlyerBySlug>> = null;
  try {
    row = await fetchPublicFlyerBySlug(slug);
  } catch {
    row = null;
  }

  if (!row) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: BG,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 800, color: INK }}>여행 유인물</div>
          <div style={{ marginTop: 16, fontSize: 26, color: SUBTITLE }}>더올투어</div>
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori data URL
            <img
              src={logoDataUrl}
              alt=""
              height={34}
              style={{ marginTop: 28, objectFit: "contain", opacity: 0.88 }}
            />
          ) : null}
        </div>
      ),
      { ...size },
    );
  }

  const { line1: titleLine1, line2: titleLine2 } = splitFlyerOgTitleLines(row.displayTitle);
  const titleParts1 = splitTitleLeadWord(titleLine1);
  const line2Promo = titleLine2 ? isOgPromoSecondLine(titleLine2) : false;
  const titleMaxLen = Math.max(titleLine1.length, titleLine2.length);
  const titleFontSize = titleLine2
    ? titleMaxLen > 17
      ? 44
      : titleMaxLen > 14
        ? 48
        : 52
    : titleMaxLen > 24
      ? 48
      : titleMaxLen > 14
        ? 54
        : 58;

  const depFirst = (row.draft.fields.departureText?.trim() ?? "").split("\n")[0]?.trim() ?? "";
  const subtitleRaw =
    row.rowSubtitle?.trim() || row.draft.fields.subtitle?.trim() || depFirst || "";
  const subtitle = subtitleRaw ? truncate(subtitleRaw, 120) : "";

  const heroCandidate = row.draft.selectedImageUrls.find((u) => u?.trim());
  let heroDataUrl: string | null = null;
  if (heroCandidate?.trim()) {
    heroDataUrl = await fetchOgImageAsDataUrl(heroCandidate.trim());
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
            paddingTop: 18,
            paddingLeft: PAD_X,
            paddingRight: PAD_X,
            paddingBottom: 2,
          }}
        >
          {heroDataUrl ? (
            <div
              style={{
                position: "relative",
                width: HERO_W,
                height: HERO_H,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid #cbd5e1",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroDataUrl}
                alt=""
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: "56%",
                  background: HERO_FADE_OVERLAY,
                }}
              />
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                width: HERO_W,
                height: HERO_H,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid #cbd5e1",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: PLACEHOLDER_BG,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: PLACEHOLDER_TEXT,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                THE ALL TOUR
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: "56%",
                  background: HERO_FADE_OVERLAY,
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            paddingLeft: PAD_X,
            paddingRight: PAD_X,
            paddingTop: 0,
            paddingBottom: 2,
            minHeight: 0,
            marginTop: -10,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              width: TEXT_MAX_W,
              maxWidth: "100%",
              textAlign: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                width: "100%",
              }}
            >
              <div
                style={{
                  fontSize: titleFontSize,
                  fontWeight: 900,
                  lineHeight: 1.08,
                  letterSpacing: "-0.035em",
                  width: "100%",
                  color: INK,
                }}
              >
                {titleParts1 ? (
                  <>
                    <span style={{ color: ACCENT }}>{titleParts1.lead}</span>
                    <span style={{ color: INK }}>{titleParts1.rest}</span>
                  </>
                ) : (
                  <span style={{ color: INK }}>{titleLine1}</span>
                )}
              </div>
              {titleLine2 ? (
                <div
                  style={{
                    fontSize: titleFontSize - 2,
                    fontWeight: 900,
                    lineHeight: 1.08,
                    letterSpacing: "-0.03em",
                    width: "100%",
                    color: line2Promo ? ACCENT : INK,
                  }}
                >
                  {titleLine2}
                </div>
              ) : null}
            </div>
            {!titleLine2 && !titleParts1 ? (
              <div
                style={{
                  width: 88,
                  height: 5,
                  background: ACCENT,
                  borderRadius: 3,
                  marginTop: 4,
                }}
              />
            ) : null}
            {subtitle ? (
              <div
                style={{
                  fontSize: 26,
                  color: SUBTITLE,
                  lineHeight: 1.42,
                  width: "100%",
                  marginTop: 2,
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUrl}
              alt=""
              height={34}
              style={{ objectFit: "contain", opacity: 0.88 }}
            />
          ) : (
            <div style={{ fontSize: 20, fontWeight: 700, color: INK, opacity: 0.88 }}>더올투어</div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
