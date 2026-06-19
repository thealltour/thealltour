import type { Metadata, Viewport } from "next";

/** /admin · /theall_manager_only 공통 PWA 메타데이터 */
export const ADMIN_PWA_METADATA: Metadata = {
  manifest: "/theall_manager_only/manifest.webmanifest",
  applicationName: "더올투어 관리",
  appleWebApp: {
    capable: true,
    title: "더올투어 관리",
    statusBarStyle: "default",
  },
  icons: {
    apple: [
      {
        url: "/theall_manager_only/icon-192.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const ADMIN_PWA_VIEWPORT: Viewport = {
  themeColor: "#1e3a5f",
};
