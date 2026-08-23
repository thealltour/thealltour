import {
  AligoRelayError,
  normalizeReceiverPhone,
} from "@/lib/notifications/sendAligoRelay";

const DEFAULT_RELAY_URL = "http://121.78.183.144:3000/send-alimtalk";
const TIMEOUT_MS = 5000;

export type SendAlimtalkRelayParams = {
  receiver: string;
  /** 수신자 이름 (recvname_1) */
  recvname?: string;
  tpl_code: string;
  subject: string;
  /** 템플릿과 동일 개행·문구, 변수만 치환된 본문 (message_1) */
  message: string;
  /** 버튼 JSON 문자열 (button_1) */
  button?: string;
  failover?: "Y" | "N";
  fsubject?: string;
  fmessage?: string;
  testMode?: "Y" | "N";
};

function resolveRelayUrl(): string {
  const fromEnv = process.env.ALIGO_ALIMTALK_RELAY_URL?.trim();
  return fromEnv || DEFAULT_RELAY_URL;
}

/**
 * 가비아 VPS 알림톡 relay로 발송 요청.
 * @throws 수신번호가 비어 있거나 HTTP 비정상 응답 시
 */
export async function sendAlimtalkRelay(
  params: SendAlimtalkRelayParams,
): Promise<{ ok: true; data: unknown }> {
  const receiver = normalizeReceiverPhone(params.receiver);
  if (!receiver) {
    throw new AligoRelayError("EMPTY_RECEIVER", "수신번호가 비어 있습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      receiver,
      tpl_code: params.tpl_code,
      subject: params.subject,
      message: params.message,
    };
    if (params.recvname?.trim()) body.recvname = params.recvname.trim();
    if (params.button?.trim()) body.button = params.button.trim();
    if (params.failover === "Y" || params.failover === "N") body.failover = params.failover;
    if (params.fsubject?.trim()) body.fsubject = params.fsubject.trim();
    if (params.fmessage?.trim()) body.fmessage = params.fmessage.trim();
    if (params.testMode === "Y" || params.testMode === "N") body.testMode = params.testMode;

    let response: Response;
    try {
      response = await fetch(resolveRelayUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new AligoRelayError("RELAY_TIMEOUT", "알림톡 relay 요청 시간 초과(5초)");
      }
      if (e instanceof TypeError) {
        throw new AligoRelayError("RELAY_NETWORK", "알림톡 relay 서버에 연결할 수 없습니다.");
      }
      throw e;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new AligoRelayError("RELAY_HTTP", `알림톡 relay HTTP ${response.status}`, {
        httpStatus: response.status,
        data,
      });
    }

    return { ok: true, data };
  } finally {
    clearTimeout(timeout);
  }
}
