/**
 * Server-only Kakao Talk "memo/default/send" (나에게 보내기).
 * Access token must be ephemeral — never persist or log.
 */

export const KAKAO_MEMO_DEFAULT_SEND_URL =
  "https://kapi.kakao.com/v2/api/talk/memo/default/send";

export const KAKAO_MEMO_TIMEOUT_MS = 7000;

export type KakaoMemoFailureCode =
  | "timeout"
  | "network"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "server_error"
  | "invalid_response"
  | "unknown";

export type KakaoMemoSendResult =
  | { ok: true }
  | { ok: false; code: KakaoMemoFailureCode; status?: number };

function classifyHttpStatus(status: number): KakaoMemoFailureCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown";
}

/**
 * Sends a Kakao default template to the token owner's "Chat with myself".
 * Does not log Authorization headers or token values.
 */
export async function sendKakaoMemoDefault(params: {
  accessToken: string;
  templateObject: Record<string, unknown>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<KakaoMemoSendResult> {
  const accessToken = params.accessToken?.trim();
  if (!accessToken) {
    return { ok: false, code: "unauthorized" };
  }

  const timeoutMs = params.timeoutMs ?? KAKAO_MEMO_TIMEOUT_MS;
  const fetchFn = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = new URLSearchParams({
      template_object: JSON.stringify(params.templateObject),
    });

    let response: Response;
    try {
      response = await fetchFn(KAKAO_MEMO_DEFAULT_SEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, code: "timeout" };
      }
      return { ok: false, code: "network" };
    }

    if (response.ok) {
      return { ok: true };
    }

    // Consume body without logging secrets
    await response.text().catch(() => "");
    return {
      ok: false,
      code: classifyHttpStatus(response.status),
      status: response.status,
    };
  } finally {
    clearTimeout(timer);
  }
}
