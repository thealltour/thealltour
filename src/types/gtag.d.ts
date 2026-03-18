/**
 * GA4 gtag 전역 타입 (layout.tsx Script 로드 후 window.gtag 사용 시 TypeScript 에러 방지)
 */
declare global {
  interface Window {
    gtag?: (command: "event", eventName: string, params?: Record<string, unknown>) => void;
  }
}

export {};
