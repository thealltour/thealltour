/**
 * PR-IMAGE-3: 외부 이미지 URL을 서버에서 fetch하여 Buffer로 가져온다.
 */

export async function downloadImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TheAllTour/1.0; +https://thealltour.com)",
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}
