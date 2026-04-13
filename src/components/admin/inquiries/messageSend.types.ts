import type { Inquiry } from "@/types/inquiry";
import type { TemplateInsertMode } from "./messageSend.utils";

export type MessageSendPanelProps = {
  inquiry: Inquiry;
  /** 가운데 패널·빠른 입력과 공유하는 문자 본문 */
  message: string;
  onMessageChange: (value: string) => void;
  /** 템플릿·가이드 삽입 방식(부모와 동기화) */
  templateInsertMode: TemplateInsertMode;
  onTemplateInsertModeChange: (mode: TemplateInsertMode) => void;
  /** 발송 성공·실패 후 활동 로그 등 */
  onSent?: () => void;
};
