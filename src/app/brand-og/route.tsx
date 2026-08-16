import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

export const runtime = "nodejs";

export async function GET() {
  const logoDataUrl = await loadTheallLogoDataUrl();

  return new ImageResponse(
    <BrandOgCard
      title="여행이 쉬워지는 맞춤 상담"
      subtitle="골프 · 가족 · 효도 · 테마여행"
      badge="일정부터 예약까지 함께"
      logoDataUrl={logoDataUrl}
      backgroundVariant="light"
      variant="home"
    />,
    { width: 1200, height: 630 },
  );
}
