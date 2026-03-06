/**
 * Admin products API client - 공통 응답 처리 유틸 (최소 범위)
 * 여러 client에서 중복되는 로직만 분리
 */

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export function extractErrorMessage(
  payload: unknown,
  fallbackMessage: string,
): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const msg = (payload as { message?: string }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallbackMessage;
}

export function buildQueryString(record: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}
