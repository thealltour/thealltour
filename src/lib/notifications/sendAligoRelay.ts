const RELAY_URL = "http://121.78.183.144:3000/send-aligo";
const TIMEOUT_MS = 5000;

export type AligoRelayErrorCode =
  | "EMPTY_RECEIVER"
  | "RELAY_HTTP"
  | "RELAY_TIMEOUT"
  | "RELAY_NETWORK";

export class AligoRelayError extends Error {
  readonly code: AligoRelayErrorCode;
  readonly httpStatus?: number;
  readonly data?: unknown;

  constructor(
    code: AligoRelayErrorCode,
    message: string,
    opts?: {
      httpStatus?: number;
      data?: unknown;
    },
  ) {
    super(message);
    this.name = "AligoRelayError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.data = opts?.data;
  }
}

/** 수신번호에서 숫자만 남깁니다. */
export function normalizeReceiverPhone(input: string): string {
  return input.replace(/\D/g, "");
}

export type SendAligoRelayParams = {
  receiver: string;
  msg: string;
  /** 문의 접수 등 relay 측 부가 메타(선택). receiver/msg 외 필드만 병합됩니다. */
  relayExtras?: Record<string, unknown>;
};

/**
 * 가비아 VPS 알리고 relay 서버로 SMS 발송 요청.
 * @throws 수신번호가 비어 있거나 HTTP 비정상 응답 시
 */
export async function sendAligoRelay(params: SendAligoRelayParams): Promise<{ ok: true; data: unknown }> {
  const receiver = normalizeReceiverPhone(params.receiver);
  if (!receiver) {
    throw new AligoRelayError("EMPTY_RECEIVER", "수신번호가 비어 있습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      receiver,
      msg: params.msg,
      ...(params.relayExtras ?? {}),
    };

    let response: Response;
    try {
      response = await fetch(RELAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new AligoRelayError("RELAY_TIMEOUT", "알리고 relay 요청 시간 초과(5초)");
      }
      if (e instanceof TypeError) {
        throw new AligoRelayError("RELAY_NETWORK", "알리고 relay 서버에 연결할 수 없습니다.");
      }
      throw e;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new AligoRelayError("RELAY_HTTP", `알리고 relay HTTP ${response.status}`, {
        httpStatus: response.status,
        data,
      });
    }

    return { ok: true, data };
  } finally {
    clearTimeout(timeout);
  }
}
