import localFont from "next/font/local";

/**
 * Pretendard Variable, self-hosted (OFL). globals.css의 --font-sans-fallback /
 * --font-display-sans는 이 변수(--font-pretendard)를 최우선으로 참조한다.
 * 폰트 파일을 직접 로드하지 않으면 브라우저는 시스템 폰트로 대체되어
 * 설계된 타이포 스케일(h1 42px 등)이 의도대로 드러나지 않는다.
 */
export const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});
