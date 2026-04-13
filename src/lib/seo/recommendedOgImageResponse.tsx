import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getRecommendedOpenGraphImageResponse(): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  return new ImageResponse(
    (
      <BrandOgCard
        tagLabel="CURATED"
        title="여행 추천"
        subtitle="더올투어가 선별한 맞춤 코스를 만나보세요."
        logoDataUrl={logoDataUrl}
        variant="home"
        backgroundVariant="navyWarm"
      />
    ),
    { ...size },
  );
}
