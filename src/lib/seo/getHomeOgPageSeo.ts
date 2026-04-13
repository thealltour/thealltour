import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";
import { HOME_METADATA_DESCRIPTION, HOME_METADATA_TITLE } from "@/lib/seo/homeOgCopy";

/** 홈(`/`) 메타·OG 라우트와 정합되는 스냅샷 */
export function getHomeOgPageSeo(): OgPageSeoData {
  return {
    type: "home",
    id: "home",
    urlPath: "/",
    pageTitle: HOME_METADATA_TITLE,
    metaDescription: HOME_METADATA_DESCRIPTION,
    imageCandidates: [],
    primaryImageUrl: null,
    eyebrow: null,
    subtitle: null,
    regionLine: null,
    themeLine: null,
    badgeLabel: null,
    openGraph: { type: "website" },
    ogImageAlt: "더올투어",
    useAbsolutePageTitle: true,
  };
}
