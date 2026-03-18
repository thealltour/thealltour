/**
 * 알리고 SMS 공통 발송 (저수준).
 * - receiver는 숫자만 남기도록 정규화.
 * - 실패 시 로그 후 throw. 래퍼에서 catch하여 API 실패로 이어지지 않도록 처리.
 */
export async function sendAligoSms({
  receiver,
  msg,
}: {
  receiver: string;
  msg: string;
}): Promise<void> {
  const normalized = receiver.replace(/\D/g, "");
  if (!normalized) {
    console.error("[SMS] 수신번호 없음 (정규화 후)", { receiver });
    throw new Error("SMS receiver empty after normalize");
  }

  const key = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;
  if (!key || !userId || !sender) {
    console.error("[SMS] 알리고 env 미설정 (ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)");
    throw new Error("SMS Aligo env not set");
  }

  const response = await fetch("https://apis.aligo.in/send/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      key,
      user_id: userId,
      sender,
      receiver: normalized,
      msg,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[SMS] 알리고 API 실패", { status: response.status, body: text });
    throw new Error(`Aligo API HTTP ${response.status}`);
  }

  const data = (await response.json()) as { result_code?: string; message?: string };
  if (data.result_code && String(data.result_code) !== "1") {
    console.error("[SMS] 알리고 응답 실패", {
      result_code: data.result_code,
      message: data.message,
    });
    throw new Error(`Aligo result_code ${data.result_code}`);
  }
}

/**
 * 고객용 접수 확인 SMS. 담백한 톤, 영업 표현 금지.
 */
export async function sendCustomerInquirySms({
  phone,
  productTitle,
}: {
  phone: string;
  productTitle?: string;
}): Promise<void> {
  const msg = productTitle
    ? `안녕하세요.\n[${productTitle}] 상담 요청이 접수되었습니다.\n\n남겨주신 내용을 확인한 뒤 안내드리겠습니다.`
    : `안녕하세요.\n상담 요청이 접수되었습니다.\n\n남겨주신 내용을 확인한 뒤 안내드리겠습니다.`;

  try {
    await sendAligoSms({ receiver: phone, msg });
  } catch (e) {
    console.error("[SMS:고객] 접수 확인 발송 실패", e);
  }
}

/**
 * 관리자용 새 문의 알림 SMS. 짧고 실무형, 문의 내용 전문 미포함.
 * 수신: process.env.ALIGO_ADMIN_RECEIVERS (콤마 구분)
 */
export async function sendAdminInquirySms({
  name,
  phone,
  productTitle,
  sourcePath,
}: {
  name: string;
  phone: string;
  productTitle?: string;
  sourcePath?: string;
}): Promise<void> {
  const raw = process.env.ALIGO_ADMIN_RECEIVERS?.trim();
  if (!raw) {
    return;
  }
  const receivers = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (receivers.length === 0) {
    return;
  }

  const productLine = productTitle || sourcePath || "일반 문의";
  const msg = [
    "[새 문의 접수]",
    `상품: ${productLine}`,
    `이름: ${name}`,
    `연락처: ${phone}`,
  ].join("\n");

  try {
    for (const receiver of receivers) {
      await sendAligoSms({ receiver, msg });
    }
  } catch (e) {
    console.error("[SMS:관리자] 새 문의 알림 발송 실패", e);
  }
}
