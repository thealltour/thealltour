import type { MetadataRoute } from "next";

import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl();
  const now = new Date();

  return [
    {
      url: base,
      lastModified: now,
    },
    {
      url: `${base}/products`,
      lastModified: now,
    },
    {
      url: `${base}/destinations`,
      lastModified: now,
    },
    {
      url: `${base}/themes`,
      lastModified: now,
    },
  ];
}
