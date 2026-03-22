/**
 * OG ImageResponse용 — 원격 이미지를 data URL로 로드 (실패 시 null).
 */

const FETCH_MS = 12_000;

export async function fetchOgImageAsDataUrl(imageUrl: string): Promise<string | null> {
  const trimmed = imageUrl?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    const res = await fetch(trimmed, {
      signal: ac.signal,
      next: { revalidate: 3600 },
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64 || buf.length > 6_000_000) return null;
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim();
    if (!ct.startsWith("image/")) return null;
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
