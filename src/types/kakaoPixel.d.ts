/**
 * 카카오 픽셀(kp.js) 전역 타입
 */
type KakaoPixelTracker = {
  pageView: (tag?: string) => void;
  completeRegistration: (tag?: string) => void;
};

declare global {
  interface Window {
    kakaoPixel?: (trackId: string) => KakaoPixelTracker;
  }
}

export {};
