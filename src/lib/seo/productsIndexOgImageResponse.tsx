import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getProductsIndexOpenGraphImageResponse(): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  return new ImageResponse(
    (
      <BrandOgCard
        tagLabel="PRODUCTS"
        title="여행상품"
        subtitle="지역·테마별로 맞춤 패키지를 찾아보세요."
        logoDataUrl={logoDataUrl}
        variant="home"
        backgroundVariant="navyWarm"
      />
    ),
    { ...size },
  );
}
