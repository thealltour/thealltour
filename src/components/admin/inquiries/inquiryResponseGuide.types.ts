import type { Inquiry } from "@/types/inquiry";

export type InquiryGuideType = "golf_custom" | "travel_quote" | "product" | "general";

export type InquiryLeadTemperature = "hot" | "warm" | "normal";

export type ResponseTemplate = {
  id: string;
  type: InquiryGuideType;
  title: string;
  description?: string;
  build: (inquiry: Inquiry) => string;
};

export type PhoneScript = {
  type: InquiryGuideType;
  opening: string[];
  questions: string[];
  closing: string[];
};

export type ProposalGuide = {
  type: InquiryGuideType;
  bullets: string[];
};

export type AlternativeStrategy = {
  type: InquiryGuideType;
  bullets: string[];
};

/** 규칙 기반 응대 가이드 분석 결과 (UI·복사 메시지 생성에 사용) */
export type InquiryGuideAnalysis = {
  type: InquiryGuideType;
  typeLabel: string;
  leadTemperature: InquiryLeadTemperature;
  leadTemperatureLabel: string;
  responseSpeedLabel: string;
  responseChannelLabel: string;
  requiredFields: string[];
  cautionItems: string[];
  generatedMessage: string;
};
