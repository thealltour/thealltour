import type { Metadata } from "next";

/** PR11: claim 토큰 페이지는 검색 노출 제외 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function ReviewClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
