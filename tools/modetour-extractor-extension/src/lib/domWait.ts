/**
 * 로딩 대기 및 셀렉터 대기 표준 유틸.
 * 새로고침/탭 전환 직후 빈 추출을 줄이기 위해 추출 전 호출.
 */

/**
 * document.readyState === "complete" 또는 window load 이벤트 대기
 */
export function waitForPageLoad(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
      return;
    }
    const onLoad = () => {
      window.removeEventListener("load", onLoad);
      resolve();
    };
    window.addEventListener("load", onLoad);
  });
}

/**
 * timeout까지 폴링하며 selector 존재 여부 확인.
 * 있으면 true, 없으면 false (타임아웃 시)
 */
export function waitForSelector(
  selector: string,
  timeoutMs = 8000,
  intervalMs = 200,
): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      try {
        const el = document.querySelector(selector);
        if (el) {
          resolve(true);
          return;
        }
      } catch {
        // invalid selector 등
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
