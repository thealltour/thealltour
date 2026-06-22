/** User-Agent → 관리자 설정 화면용 기기 라벨 */
export function parseAdminDeviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return "알 수 없는 기기";

  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "Android 휴대폰";
  if (/Android/.test(ua)) return "Android 태블릿";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/CrOS/.test(ua)) return "Chromebook";

  return "웹 브라우저";
}
