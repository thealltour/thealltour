import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const SIZE = { width: 1200, height: 630 } as const;

export async function getKakaoSyncOgImageResponse(): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();

  return new ImageResponse(
    (
      <BrandOgCard
        tagLabel="KAKAO"
        title="1인당 5만원 · 팀 전체 할인"
        subtitle="카카오 간편가입 시 즉시 적용 · 대표 1명만 가입해도 OK"
        logoDataUrl={logoDataUrl}
        variant="home"
        backgroundVariant="navyWarm"
      />
    ),
    { ...SIZE },
  );
}
