import { normalizeReceiverPhone } from "@/lib/notifications/sendAligoRelay";
import type { Inquiry } from "@/types/inquiry";
import { analyzeInquiryGuide, getPhoneScriptByType, getTemplatesByType } from "./inquiryResponseGuide.utils";
import type { PhoneScript } from "./inquiryResponseGuide.types";

export type TemplateInsertMode = "replace" | "append";

export function normalizePhone(input: string): string {
  return normalizeReceiverPhone(input);
}

/** 표시용 하이픈(저장·발송 값은 digits 그대로 유지) */
export function formatPhoneDisplay(digits: string): string {
  const d = normalizeReceiverPhone(digits);
  if (d.length === 11 && d.startsWith("010")) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10 && d.startsWith("02")) {
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11 && d.startsWith("01")) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  return d || "—";
}

export function applyTemplateToMessage(opts: {
  currentText: string;
  templateText: string;
  mode: TemplateInsertMode;
}): string {
  const tpl = opts.templateText;
  if (opts.mode === "replace") return tpl;
  const cur = opts.currentText;
  if (!cur.trim()) return tpl;
  const sep = cur.endsWith("\n") ? "\n" : "\n\n";
  return `${cur}${sep}${tpl}`;
}

export function buildDefaultCustomerSms(inquiry: Inquiry): string {
  const name = (inquiry.name ?? "").trim() || "고객";
  return `안녕하세요 ${name}님,\n문의 주신 내용 확인 중이며 확인 후 안내드리겠습니다.`;
}

export function buildFirstResponseSms(inquiry: Inquiry): string {
  return analyzeInquiryGuide(inquiry).generatedMessage;
}

export function buildFirstTemplateSms(inquiry: Inquiry): string | null {
  const analysis = analyzeInquiryGuide(inquiry);
  const templates = getTemplatesByType(analysis.type);
  const first = templates[0];
  return first ? first.build(inquiry) : null;
}

export function formatPhoneScriptForSms(script: PhoneScript): string {
  return [
    "【오프닝】",
    ...script.opening,
    "",
    "【핵심 질문】",
    ...script.questions,
    "",
    "【마무리】",
    ...script.closing,
  ].join("\n");
}

export function buildPhoneScriptSms(inquiry: Inquiry): string | null {
  const analysis = analyzeInquiryGuide(inquiry);
  const script = getPhoneScriptByType(analysis.type);
  return script ? formatPhoneScriptForSms(script) : null;
}
