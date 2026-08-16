import { ImageResponse } from "next/og";
import { KakaoSyncOgCard } from "@/components/seo/KakaoSyncOgCard";
import { loadPublicImageDataUrl, loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const SIZE = { width: 1200, height: 630 } as const;
const HERO_PATH = "/images/landings/kakao-sync-golf-hero.png";

export async function getKakaoSyncOgImageResponse(): Promise<ImageResponse> {
  const [logoDataUrl, heroImageDataUrl] = await Promise.all([
    loadTheallLogoDataUrl(),
    loadPublicImageDataUrl(HERO_PATH),
  ]);

  return new ImageResponse(
    <KakaoSyncOgCard logoDataUrl={logoDataUrl} heroImageDataUrl={heroImageDataUrl} />,
    { ...SIZE },
  );
}
