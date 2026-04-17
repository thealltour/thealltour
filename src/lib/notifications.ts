import type { InquiryInput } from "@/types/inquiry";

type NotificationResult = {
  channel: "slack" | "email" | "kakao";
  ok: boolean;
  reason?: string;
};

async function sendSlackNotification(payload: InquiryInput): Promise<NotificationResult> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { channel: "slack", ok: false, reason: "SLACK_WEBHOOK_URL 미설정" };
  }

  const message = [
    "*[더올투어 신규 문의]*",
    `- 이름: ${payload.name}`,
    `- 연락처: ${payload.phone}`,
    `- 문의내용: ${payload.content}`,
  ].join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    return { channel: "slack", ok: false, reason: `HTTP ${response.status}` };
  }

  return { channel: "slack", ok: true };
}

async function sendEmailNotification(payload: InquiryInput): Promise<NotificationResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFY_EMAIL_FROM;
  const toEmail = process.env.NOTIFY_EMAIL_TO;

  if (!apiKey || !fromEmail || !toEmail) {
    return {
      channel: "email",
      ok: false,
      reason: "RESEND_API_KEY 또는 NOTIFY_EMAIL_FROM/TO 미설정",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: "[더올투어] 신규 문의가 접수되었습니다",
      text: `이름: ${payload.name}\n연락처: ${payload.phone}\n문의내용: ${payload.content}`,
    }),
  });

  if (!response.ok) {
    return { channel: "email", ok: false, reason: `HTTP ${response.status}` };
  }

  return { channel: "email", ok: true };
}

async function sendKakaoNotification(payload: InquiryInput): Promise<NotificationResult> {
  const webhookUrl = process.env.KAKAO_WEBHOOK_URL;
  if (!webhookUrl) {
    return { channel: "kakao", ok: false, reason: "KAKAO_WEBHOOK_URL 미설정" };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "[더올투어 신규 문의]",
      name: payload.name,
      phone: payload.phone,
      content: payload.content,
    }),
  });

  if (!response.ok) {
    return { channel: "kakao", ok: false, reason: `HTTP ${response.status}` };
  }

  return { channel: "kakao", ok: true };
}

/** 운영 알림용 — 문의 외 배치·장애 등 짧은 텍스트 */
export async function sendSlackPlainText(text: string): Promise<{ ok: boolean; reason?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, reason: "SLACK_WEBHOOK_URL 미설정" };
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status}` };
  }
  return { ok: true };
}

export async function notifyInquiryCreated(payload: InquiryInput) {
  const settled = await Promise.allSettled([
    sendSlackNotification(payload),
    sendEmailNotification(payload),
    sendKakaoNotification(payload),
  ]);

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      if (!result.value.ok) {
        console.warn(`[notify:${result.value.channel}] ${result.value.reason}`);
      }
      return;
    }
    console.warn(`[notify:error] ${result.reason}`);
  });
}
