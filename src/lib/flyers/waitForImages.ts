/**
 * PNG(html-to-image) 직전: 루트 이하 모든 img의 로드 완료를 기다립니다.
 * 로드 실패(onerror)도 resolve하여 export 파이프라인이 멈추지 않게 합니다.
 */
export async function waitForImages(root: Element): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) {
        return img.decode?.().catch(() => undefined) ?? Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.onload = done;
        img.onerror = done;
      }).then(() => img.decode?.().catch(() => undefined));
    }),
  );
}
