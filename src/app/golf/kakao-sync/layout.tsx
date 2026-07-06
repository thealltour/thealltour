import type { ReactNode } from "react";

/** 카카오싱크 하드코딩 랜딩: 모바일 전폭 + 사이트 푸터(사업자 정보) */
export default function KakaoSyncGolfLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen w-full bg-white">{children}</div>;
}
