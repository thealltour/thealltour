/**
 * Supabase Storage public URL → bucket + object path
 * 형식: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
 */
export function parseSupabaseStoragePublicUrl(url: string): { bucket: string; path: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const marker = "/storage/v1/object/public/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rest = u.pathname.slice(idx + marker.length);
    const firstSlash = rest.indexOf("/");
    if (firstSlash === -1) return null;
    const bucket = rest.slice(0, firstSlash);
    let path = rest.slice(firstSlash + 1);
    if (!bucket || !path) return null;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* 그대로 사용 */
    }
    return { bucket, path };
  } catch {
    return null;
  }
}
