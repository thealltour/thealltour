import type { Metadata } from "next";
import PublicFlyerClient from "@/components/flyers/PublicFlyerClient";
import { fetchPublicFlyerBySlug } from "@/lib/flyers/fetchPublicFlyerBySlug";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = getSiteBaseUrl();
  const path = `/flyers/${encodeURIComponent(slug)}`;
  const pageUrl = `${siteUrl}${path}`;
  const ogImageUrl = `${siteUrl}${path}/opengraph-image`;

  let loaded: Awaited<ReturnType<typeof fetchPublicFlyerBySlug>> = null;
  try {
    loaded = await fetchPublicFlyerBySlug(slug);
  } catch {
    loaded = null;
  }
  const title = loaded?.displayTitle ?? "여행 유인물 | 더올투어";
  const depFirst = loaded
    ? (loaded.draft.fields.departureText?.trim() ?? "").split("\n")[0]?.trim() ?? ""
    : "";
  const description =
    loaded?.rowSubtitle?.trim() ||
    loaded?.draft.fields.subtitle?.trim() ||
    depFirst ||
    "더올투어 여행 유인물 — 일정·안내를 한 장으로 확인하세요.";

  return {
    title: loaded ? `${loaded.displayTitle} | 더올투어` : title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "더올투어",
      title: loaded?.displayTitle ?? title,
      description,
      locale: "ko_KR",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: loaded?.displayTitle ?? title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicFlyerPage({ params }: PageProps) {
  const { slug } = await params;
  return <PublicFlyerClient slug={slug} />;
}
