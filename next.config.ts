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
    deviceSizes: [375, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [96, 128, 192, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
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
    ],
  },
};

export default nextConfig;
