import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { ProductOgCard } from "@/components/seo/ProductOgCard";
import { fetchPublicFlyerBySlug } from "@/lib/flyers/fetchPublicFlyerBySlug";
import { fetchOgImageAsDataUrl } from "@/lib/seo/fetchOgImageAsDataUrl";
import { splitFlyerOgTitleLines } from "@/lib/seo/flyerOgTitleLines";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * 공개 유인물 `/flyers/[slug]`용 Open Graph / Twitter 카드 ImageResponse.
 * 홈·상품과 동일한 다크 브랜드 셸을 사용한다.
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
        <BrandOgCard
          tagLabel="FLYER"
          title="여행 유인물"
          subtitle="더올투어에서 맞춤 여행을 찾아보세요."
          logoDataUrl={logoDataUrl}
        />
      ),
      { ...size },
    );
  }

  const { line1: titleLine1, line2: titleLine2 } = splitFlyerOgTitleLines(row.displayTitle);
  const productTitle = titleLine2 ? `${titleLine1} ${titleLine2}`.trim() : titleLine1;

  const depFirst = (row.draft.fields.departureText?.trim() ?? "").split("\n")[0]?.trim() ?? "";
  const subtitleRaw =
    row.rowSubtitle?.trim() || row.draft.fields.subtitle?.trim() || depFirst || "";
  const summaryLine = subtitleRaw ? truncate(subtitleRaw, 88) : null;

  const heroCandidate = row.draft.selectedImageUrls.find((u) => u?.trim());
  let heroDataUrl: string | null = null;
  if (heroCandidate?.trim()) {
    heroDataUrl = await fetchOgImageAsDataUrl(heroCandidate.trim());
  }

  if (heroDataUrl) {
    return new ImageResponse(
      (
        <ProductOgCard
          logoDataUrl={logoDataUrl}
          productTitle={productTitle || "여행 유인물"}
          summaryLine={summaryLine}
          heroImageDataUrl={heroDataUrl}
        />
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <BrandOgCard
        tagLabel="FLYER"
        title={productTitle || "여행 유인물"}
        subtitle={summaryLine ?? "더올투어 맞춤 여행"}
        logoDataUrl={logoDataUrl}
      />
    ),
    { ...size },
  );
}
