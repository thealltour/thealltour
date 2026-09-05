import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const contentSecurityPolicy = `
  default-src 'self';
  base-uri 'self';
  form-action 'self' https://mobile.inicis.com;
  object-src 'none';
  frame-ancestors 'self';
  worker-src 'self';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  style-src 'self' 'unsafe-inline' https://emrldtp.com https://*.emrldtp.com https://fonts.googleapis.com;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://t1.daumcdn.net https://vercel.live https://cdn.portone.io https://*.iamport.kr https://*.iamport.co https://ads-partners.coupang.com https://emrldtp.com https://*.emrldtp.com https://www.travelpayouts.com https://*.travelpayouts.com https://maps.googleapis.com https://maps.gstatic.com;
  connect-src 'self' https: ws: wss: https://api.portone.io https://*.iamport.kr https://*.iamport.co;
  frame-src 'self' https://www.youtube.com https://player.vimeo.com https://*.portone.io https://cdn.portone.io https://*.iamport.kr https://*.iamport.co https://checkout-service.prod.iamport.co https://*.toss.im https://*.inicis.com https://*.kcp.co.kr https://*.kakaopay.com https://*.naver.com https://ads-partners.coupang.com https://emrldtp.com https://*.emrldtp.com https://*.travelpayouts.com;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/admin/tools/extensions/**/*": ["./public/extension-builds/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "110mb",
    },
    // middleware.ts가 /api/admin 을 가로채면 본문을 복제한다. 기본 10MB를 넘기면
    // FormData가 잘려 클라이언트는 '네트워크 오류'로만 보인다.
    proxyClientMaxBodySize: "110mb",
  },
  turbopack: {
    root: __dirname,
  },
  // Sentry → Prisma/OpenTelemetry가 require(변수)를 써서, 서버 라우트 컴파일마다
  // "Critical dependency" 경고와 Import trace가 반복된다. 동작에는 영향 없음.
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(Array.isArray(config.ignoreWarnings) ? config.ignoreWarnings : []),
      {
        module: /@opentelemetry[\\/]instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [360, 375, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [96, 128, 192, 256, 360, 384],
    // Next.js 16+: quality 값을 allowlist로 제한. 기본 75 + 히어로(HeroSection/HeroPanorama) 82.
    qualities: [75, 82],
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
        source: "/extension-builds/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
        ],
      },
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
