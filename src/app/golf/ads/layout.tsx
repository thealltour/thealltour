import type { ReactNode } from "react";

/** 비즈보드 랜딩: 전폭 본문 + 사이트 푸터(사업자 정보) */
export default function GolfAdsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen w-full bg-white">{children}</div>;
}
