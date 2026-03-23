import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "110mb",
    },
    // API 라우트 FormData 업로드 시 본문 크기 제한 (기본 10MB → 110MB)
    proxyClientMaxBodySize: "110mb",
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [360, 375, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [96, 128, 192, 256, 360, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "img.modetour.com",
      },
      {
        protocol: "https",
        hostname: "qmswixmwquuazrhfyils.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.kiwi.com",
      },
      {
        protocol: "https",
        hostname: "prod-files-secure.s3.us-west-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "s3.us-west-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "www.notion.so",
      },
      {
        protocol: "https",
        hostname: "notion.so",
      },
      {
        protocol: "https",
        hostname: "images.notion.so",
      },
      {
        protocol: "https",
        hostname: "file.notion.so",
      },
      {
        protocol: "https",
        hostname: "img.notionusercontent.com",
      },
      {
        protocol: "https",
        hostname: "quick-hen-cc9.notion.site",
      },
      {
        protocol: "https",
        hostname: "image-tc.galaxy.tf",
      },
      /* Google Photos / Drive 공유 링크 썸네일 (lh3~lh6 등) */
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
