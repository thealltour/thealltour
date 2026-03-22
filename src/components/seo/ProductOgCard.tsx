/**
 * 상품 상세 OG 전용 카드 (next/og / Satori).
 * 대표 이미지 유무에 따라 레이아웃 분기 — 실패 시에도 텍스트만으로 렌더.
 */

export type ProductOgCardProps = {
  productTitle: string;
  regionLine?: string | null;
  themeLine?: string | null;
  summaryLine?: string | null;
  priceLabel?: string | null;
  logoDataUrl?: string | null;
  heroImageDataUrl?: string | null;
};

const FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif';
const PANEL_BG =
  "linear-gradient(160deg, #0b1220 0%, #0f172a 42%, #1a2332 100%)";
const ACCENT_BAR = "linear-gradient(90deg, #ea580c, #fb923c, #ea580c)";
const TEXT = "#f8fafc";
const MUTED = "#94a3b8";

function clipTitle(s: string, max = 68): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function clipLine(s: string, max = 96): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function TextPanel({
  productTitle,
  regionLine,
  themeLine,
  summaryLine,
  priceLabel,
  logoDataUrl,
  compactPadding,
}: Omit<ProductOgCardProps, "heroImageDataUrl"> & { compactPadding: boolean }) {
  const title = clipTitle(productTitle);
  const metaParts = [regionLine?.trim(), themeLine?.trim()].filter(Boolean) as string[];
  const metaRow = metaParts.length ? clipLine(metaParts.join(" · "), 72) : null;
  const summary = summaryLine?.trim() ? clipLine(summaryLine.trim(), 120) : null;
  const titleSize = compactPadding ? 38 : 48;
  const pad = compactPadding ? "40px 48px 44px 52px" : "48px 72px 56px";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        background: PANEL_BG,
      }}
    >
      <div style={{ height: 5, width: "100%", flexShrink: 0, background: ACCENT_BAR }} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: pad,
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          {logoDataUrl ? (
            <img
              src={logoDataUrl}
              alt=""
              height={36}
              style={{ height: 36, width: "auto", objectFit: "contain", marginRight: 16 }}
            />
          ) : null}
          <span style={{ fontSize: 22, fontWeight: 700, color: TEXT }}>더올투어</span>
        </div>

        <div
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            marginBottom: metaRow || summary || priceLabel ? 14 : 0,
          }}
        >
          {title}
        </div>

        {metaRow ? (
          <div style={{ fontSize: 22, fontWeight: 600, color: MUTED, marginBottom: summary ? 10 : 0 }}>
            {metaRow}
          </div>
        ) : null}

        {summary ? (
          <div style={{ fontSize: 20, fontWeight: 500, color: MUTED, lineHeight: 1.4 }}>{summary}</div>
        ) : null}

        {priceLabel?.trim() ? (
          <div style={{ marginTop: 18, fontSize: 26, fontWeight: 700, color: "#fdba74" }}>
            {priceLabel.trim()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductOgCard(props: ProductOgCardProps) {
  const {
    productTitle,
    regionLine,
    themeLine,
    summaryLine,
    priceLabel,
    logoDataUrl,
    heroImageDataUrl,
  } = props;
  const hasPhoto = Boolean(heroImageDataUrl);

  if (!hasPhoto) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT,
        }}
      >
        <TextPanel
          productTitle={productTitle}
          regionLine={regionLine}
          themeLine={themeLine}
          summaryLine={summaryLine}
          priceLabel={priceLabel}
          logoDataUrl={logoDataUrl}
          compactPadding={false}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        fontFamily: FONT,
        background: "#0f172a",
      }}
    >
      <div
        style={{
          width: 520,
          height: "100%",
          position: "relative",
          display: "flex",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <img
          src={heroImageDataUrl!}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, transparent 55%, rgba(15,23,42,0.92) 100%)",
          }}
        />
      </div>
      <TextPanel
        productTitle={productTitle}
        regionLine={regionLine}
        themeLine={themeLine}
        summaryLine={summaryLine}
        priceLabel={priceLabel}
        logoDataUrl={logoDataUrl}
        compactPadding
      />
    </div>
  );
}
