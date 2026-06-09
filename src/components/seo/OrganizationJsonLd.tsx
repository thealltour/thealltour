import { getSiteSettings } from "@/lib/siteSettings";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";
import { THEALL_WORDMARK_LIGHT_SRC } from "@/lib/brandAssets";

export async function OrganizationJsonLd() {
  const settings = await getSiteSettings();
  const siteUrl = getSiteBaseUrl();

  const sameAs = [
    settings.instagram_url?.trim(),
    settings.naver_blog_url?.trim(),
    settings.naver_band_url?.trim(),
    settings.kakao_channel_url?.trim(),
  ].filter((url): url is string => Boolean(url && url.startsWith("http")));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.company_name?.trim() || "더올투어",
    url: siteUrl,
    logo: `${siteUrl}${THEALL_WORDMARK_LIGHT_SRC}`,
    sameAs,
  };

  return (
    <script
      id="organization-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
