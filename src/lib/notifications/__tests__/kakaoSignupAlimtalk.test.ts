import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendAlimtalkRelayMock = vi.fn();

vi.mock("@/lib/notifications/sendAlimtalkRelay", () => ({
  sendAlimtalkRelay: (...args: unknown[]) => sendAlimtalkRelayMock(...args),
}));

import {
  CUSTOMER_NAME_PLACEHOLDER,
  DEFAULT_KAKAO_SIGNUP_TPL_CODE,
  replaceCustomerNamePlaceholder,
  resolveCustomerName,
  sendKakaoSignupAlimtalk,
} from "@/lib/notifications/kakaoSignupAlimtalk";

describe("resolveCustomerName / replaceCustomerNamePlaceholder", () => {
  it("falls back to 고객 when empty", () => {
    expect(resolveCustomerName(null)).toBe("고객");
    expect(resolveCustomerName("  ")).toBe("고객");
    expect(resolveCustomerName("홍길동")).toBe("홍길동");
  });

  it("replaces only #{고객명}", () => {
    const template = `${CUSTOMER_NAME_PLACEHOLDER}님, 가입을 환영합니다.\n다른변수:#{주문번호}`;
    expect(replaceCustomerNamePlaceholder(template, "홍길동")).toBe(
      "홍길동님, 가입을 환영합니다.\n다른변수:#{주문번호}",
    );
  });

  it("uses 고객 when name missing", () => {
    expect(replaceCustomerNamePlaceholder(`${CUSTOMER_NAME_PLACEHOLDER}님`, "")).toBe("고객님");
  });
});

describe("sendKakaoSignupAlimtalk", () => {
  const envKeys = [
    "ALIGO_KAKAO_TPL_CODE_SIGNUP",
    "ALIGO_KAKAO_SIGNUP_SUBJECT",
    "ALIGO_KAKAO_SIGNUP_MESSAGE",
    "ALIGO_KAKAO_SIGNUP_BUTTON",
    "ALIGO_KAKAO_SIGNUP_FAILOVER",
    "ALIGO_KAKAO_SIGNUP_FSUBJECT",
    "ALIGO_KAKAO_SIGNUP_FMESSAGE",
    "ALIGO_ALIMTALK_TEST_MODE",
  ] as const;

  const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

  beforeEach(() => {
    sendAlimtalkRelayMock.mockReset();
    sendAlimtalkRelayMock.mockResolvedValue({ ok: true, data: { code: 0 } });
    for (const key of envKeys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const prev = saved[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it("skips when phone is empty", async () => {
    process.env.ALIGO_KAKAO_SIGNUP_SUBJECT = "가입";
    process.env.ALIGO_KAKAO_SIGNUP_MESSAGE = `${CUSTOMER_NAME_PLACEHOLDER}님`;
    const result = await sendKakaoSignupAlimtalk({ phone: "", customerName: "홍길동" });
    expect(result).toEqual({ ok: false, skipped: "empty_phone" });
    expect(sendAlimtalkRelayMock).not.toHaveBeenCalled();
  });

  it("skips when message env is missing", async () => {
    process.env.ALIGO_KAKAO_SIGNUP_SUBJECT = "가입";
    const result = await sendKakaoSignupAlimtalk({ phone: "010-1234-5678", customerName: "홍길동" });
    expect(result).toEqual({ ok: false, skipped: "missing_message_env" });
    expect(sendAlimtalkRelayMock).not.toHaveBeenCalled();
  });

  it("skips when subject env is missing", async () => {
    process.env.ALIGO_KAKAO_SIGNUP_MESSAGE = `${CUSTOMER_NAME_PLACEHOLDER}님`;
    const result = await sendKakaoSignupAlimtalk({ phone: "01012345678", customerName: "홍길동" });
    expect(result).toEqual({ ok: false, skipped: "missing_subject_env" });
    expect(sendAlimtalkRelayMock).not.toHaveBeenCalled();
  });

  it("sends with #{고객명} substituted and default tpl_code", async () => {
    process.env.ALIGO_KAKAO_SIGNUP_SUBJECT = "카카오싱크 회원가입";
    process.env.ALIGO_KAKAO_SIGNUP_MESSAGE = `${CUSTOMER_NAME_PLACEHOLDER}님, 환영합니다.`;
    process.env.ALIGO_ALIMTALK_TEST_MODE = "Y";

    const result = await sendKakaoSignupAlimtalk({
      phone: "010-9876-5432",
      customerName: "김더올",
    });

    expect(result).toEqual({ ok: true });
    expect(sendAlimtalkRelayMock).toHaveBeenCalledWith({
      receiver: "01098765432",
      recvname: "김더올",
      tpl_code: DEFAULT_KAKAO_SIGNUP_TPL_CODE,
      subject: "카카오싱크 회원가입",
      message: "김더올님, 환영합니다.",
      button: undefined,
      failover: undefined,
      fsubject: undefined,
      fmessage: undefined,
      testMode: "Y",
    });
  });

  it("includes failover fields when enabled", async () => {
    process.env.ALIGO_KAKAO_SIGNUP_SUBJECT = "제목";
    process.env.ALIGO_KAKAO_SIGNUP_MESSAGE = `${CUSTOMER_NAME_PLACEHOLDER}`;
    process.env.ALIGO_KAKAO_SIGNUP_FAILOVER = "Y";
    process.env.ALIGO_KAKAO_SIGNUP_FSUBJECT = "대체제목";
    process.env.ALIGO_KAKAO_SIGNUP_FMESSAGE = "대체본문";
    process.env.ALIGO_KAKAO_TPL_CODE_SIGNUP = "UK_5796";

    await sendKakaoSignupAlimtalk({ phone: "01011112222", customerName: "이투어" });

    expect(sendAlimtalkRelayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        failover: "Y",
        fsubject: "대체제목",
        fmessage: "대체본문",
        tpl_code: "UK_5796",
      }),
    );
  });

  it("returns ok:false without throwing when relay fails", async () => {
    process.env.ALIGO_KAKAO_SIGNUP_SUBJECT = "제목";
    process.env.ALIGO_KAKAO_SIGNUP_MESSAGE = `${CUSTOMER_NAME_PLACEHOLDER}`;
    sendAlimtalkRelayMock.mockRejectedValue(new Error("relay down"));

    const result = await sendKakaoSignupAlimtalk({ phone: "01011112222", customerName: "테스트" });
    expect(result.ok).toBe(false);
    if (!result.ok && "error" in result) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
