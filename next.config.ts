import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const contentSecurityPolicy = `
  default-src 'self';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  frame-ancestors 'self';
  worker-src 'self';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  style-src 'self' 'unsafe-inline';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://vercel.live;
  connect-src 'self' https: ws: wss:;
  frame-src 'self' https://www.youtube.com https://player.vimeo.com;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
        hostname: "*.hanatour.com",
      },
      {
        protocol: "http",
        hostname: "*.hanatour.com",
      },
      {
        protocol: "https",
        hostname: "static.hanatour.net",
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
      /* 네이버/티스토리 블로그 RSS 썸네일 */
      {
        protocol: "https",
        hostname: "*.pstatic.net",
      },
      {
        protocol: "https",
        hostname: "blog.naver.com",
      },
      {
        protocol: "https",
        hostname: "*.daumcdn.net",
      },
      {
        protocol: "https",
        hostname: "*.kakaocdn.net",
      },
      {
        protocol: "https",
        hostname: "*.tistory.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
