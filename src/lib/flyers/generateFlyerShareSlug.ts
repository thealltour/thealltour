const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

/** URL-safe 짧은 slug (공개 share route 확장용). */
export function generateFlyerShareSlug(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < length; i++) {
    s += ALPHANUM[bytes[i]! % ALPHANUM.length];
  }
  return s;
}
