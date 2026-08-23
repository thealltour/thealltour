import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AligoRelayError } from "@/lib/notifications/sendAligoRelay";
import { sendAlimtalkRelay } from "@/lib/notifications/sendAlimtalkRelay";

describe("sendAlimtalkRelay", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;
  const savedUrl = process.env.ALIGO_ALIMTALK_RELAY_URL;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.ALIGO_ALIMTALK_RELAY_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (savedUrl === undefined) delete process.env.ALIGO_ALIMTALK_RELAY_URL;
    else process.env.ALIGO_ALIMTALK_RELAY_URL = savedUrl;
  });

  it("throws EMPTY_RECEIVER when phone has no digits", async () => {
    await expect(
      sendAlimtalkRelay({
        receiver: "---",
        tpl_code: "UK_5796",
        subject: "제목",
        message: "본문",
      }),
    ).rejects.toMatchObject({ code: "EMPTY_RECEIVER" } satisfies Partial<AligoRelayError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs JSON to default relay URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { code: 0 } }),
    });

    const result = await sendAlimtalkRelay({
      receiver: "010-1234-5678",
      recvname: "홍길동",
      tpl_code: "UK_5796",
      subject: "가입",
      message: "홍길동님 환영합니다.",
      testMode: "Y",
    });

    expect(result).toEqual({ ok: true, data: { ok: true, data: { code: 0 } } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://121.78.183.144:3000/send-alimtalk");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      receiver: "01012345678",
      recvname: "홍길동",
      tpl_code: "UK_5796",
      subject: "가입",
      message: "홍길동님 환영합니다.",
      testMode: "Y",
    });
  });

  it("uses ALIGO_ALIMTALK_RELAY_URL when set", async () => {
    process.env.ALIGO_ALIMTALK_RELAY_URL = "http://localhost:3999/send-alimtalk";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await sendAlimtalkRelay({
      receiver: "01011112222",
      tpl_code: "UK_5796",
      subject: "s",
      message: "m",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3999/send-alimtalk");
  });

  it("throws RELAY_HTTP on non-OK response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: "bad gateway" }),
    });

    await expect(
      sendAlimtalkRelay({
        receiver: "01011112222",
        tpl_code: "UK_5796",
        subject: "s",
        message: "m",
      }),
    ).rejects.toMatchObject({
      code: "RELAY_HTTP",
      httpStatus: 502,
    });
  });

  it("throws RELAY_TIMEOUT when aborted", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    vi.useFakeTimers();
    const promise = sendAlimtalkRelay({
      receiver: "01011112222",
      tpl_code: "UK_5796",
      subject: "s",
      message: "m",
    });
    const assertion = expect(promise).rejects.toMatchObject({ code: "RELAY_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    vi.useRealTimers();
  });
});
