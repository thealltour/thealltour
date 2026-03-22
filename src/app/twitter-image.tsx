import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { HOME_OG_IMAGE_SUBTITLE, HOME_OG_IMAGE_TITLE } from "@/lib/seo/homeOgCopy";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function Image() {
  const logoDataUrl = await loadTheallLogoDataUrl();

  return new ImageResponse(
    (
      <BrandOgCard
        eyebrow="더올투어"
        title={HOME_OG_IMAGE_TITLE}
        subtitle={HOME_OG_IMAGE_SUBTITLE}
        logoDataUrl={logoDataUrl}
        backgroundVariant="navyWarm"
        variant="home"
      />
    ),
    {
      ...size,
    },
  );
}
