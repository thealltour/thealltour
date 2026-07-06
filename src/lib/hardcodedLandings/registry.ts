export type HardcodedLandingEntry = {
  id: string;
  title: string;
  publicPath: string;
  configPath: string;
  componentPath: string;
  updatedAt: string;
  description: string;
};

export const HARDCODED_LANDINGS: HardcodedLandingEntry[] = [
  {
    id: "kakao-sync-golf",
    title: "카카오싱크 골프 랜딩",
    publicPath: "/golf/kakao-sync",
    configPath: "src/lib/hardcodedLandings/kakaoSyncGolf/config.ts",
    componentPath: "src/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfLandingPage.tsx",
    updatedAt: "2026-07-06",
    description: "비즈보드·카카오싱크 유입용 모바일 랜딩",
  },
];

export function getHardcodedLandingById(id: string): HardcodedLandingEntry | undefined {
  return HARDCODED_LANDINGS.find((entry) => entry.id === id);
}

export function resolveHardcodedLandingPublicUrl(path: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://thealltour.com";
  return `${origin.replace(/\/$/, "")}${path}`;
}
