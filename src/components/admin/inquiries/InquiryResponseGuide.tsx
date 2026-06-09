"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Inquiry, InquiryLeadPriority, InquiryResponseStage } from "@/types/inquiry";
import { INQUIRY_LEAD_PRIORITIES, INQUIRY_RESPONSE_STAGES } from "@/types/inquiry";
import {
  analyzeInquiryGuide,
  formatDateTimeLocalInput,
  getAlternativeStrategyByType,
  getChecklistLabel,
  getDefaultChecklist,
  getLeadPriorityLabel,
  getLeadPriorityTone,
  getPhoneScriptByType,
  getProposalGuideByType,
  getTemplatesByType,
  inferInquiryType,
  mergeStoredChecklist,
  parseDateTimeLocalToIso,
} from "./inquiryResponseGuide.utils";
import type { InquiryGuideAnalysis, InquiryLeadTemperature, PhoneScript } from "./inquiryResponseGuide.types";
import { InquiryActivityTimeline } from "./InquiryActivityTimeline";

const STAGE_LABELS: Record<InquiryResponseStage, string> = {
  initial_response: "1차 응답",
  waiting_customer: "고객 회신 대기",
  checking_availability: "가능 여부·수배 확인",
  proposal_sent: "견적·안 발송",
  follow_up: "후속 조율",
  closed: "종료",
};

function formatShortClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatFullDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function leadBadgeClass(lead: InquiryLeadTemperature): string {
  if (lead === "hot") return "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200";
  if (lead === "warm") return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
  return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
}

function leadPriorityBadgeClass(tone: ReturnType<typeof getLeadPriorityTone>): string {
  if (tone === "red") return "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200";
  if (tone === "amber") return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300";
}

function formatPhoneScriptFull(script: PhoneScript): string {
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

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type SectionCardProps = {
  title: string;
  children: ReactNode;
};

function SectionCard({ title, children }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

type CopyFlash = null | "first" | "template" | "phone";

type Props = {
  inquiry: Inquiry;
  onSaved?: (inquiry: Inquiry) => void;
  /** 가운데 매뉴얼에서 우측 문자 편집기로 본문을 보냅니다. */
  onUseAsMessageDraft?: (text: string) => void;
  /** 문자 발송 등 외부 이벤트 시 활동 타임라인을 갱신합니다(문의별로 증가하는 값). */
  externalTimelineBump?: number;
  /** split: 응대·운영을 각각 독립 스크롤 열로 렌더 (문의 상세 4열 레이아웃) */
  layout?: "stacked" | "split";
};

const SPLIT_COLUMN_CLASS =
  "min-h-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-muted)]/30 px-3 py-4 xl:border-t-0 xl:border-l xl:max-h-none max-h-[min(42vh,480px)]";

export function InquiryResponseGuide({
  inquiry,
  onSaved,
  onUseAsMessageDraft,
  externalTimelineBump,
  layout = "stacked",
}: Props) {
  const analysis = useMemo(() => analyzeInquiryGuide(inquiry), [inquiry]);

  const templates = useMemo(() => getTemplatesByType(analysis.type), [analysis.type]);
  const phoneScript = useMemo(() => getPhoneScriptByType(analysis.type), [analysis.type]);
  const proposalGuide = useMemo(() => getProposalGuideByType(analysis.type), [analysis.type]);
  const alternativeStrategy = useMemo(() => getAlternativeStrategyByType(analysis.type), [analysis.type]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId((prev) => (prev && templates.some((t) => t.id === prev) ? prev : templates[0].id));
  }, [templates]);

  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) ?? null : null),
    [templates, selectedTemplateId],
  );

  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const gt = inferInquiryType((inquiry.content ?? "").trim(), inquiry.product_title);
    return mergeStoredChecklist(getDefaultChecklist(gt), inquiry.response_checklist ?? undefined);
  });
  const [note, setNote] = useState(inquiry.response_note ?? "");
  const [stage, setStage] = useState<InquiryResponseStage>(inquiry.response_stage ?? "initial_response");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savedAtDisplay, setSavedAtDisplay] = useState<string | null>(inquiry.response_updated_at ?? null);

  const [copyFlash, setCopyFlash] = useState<CopyFlash>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const [assigneeName, setAssigneeName] = useState(() => inquiry.assignee_name ?? "");
  const [leadPriority, setLeadPriority] = useState<"" | InquiryLeadPriority>(() => inquiry.lead_priority ?? "");
  const [nextAction, setNextAction] = useState(() => inquiry.next_action ?? "");
  const [followUpAtLocal, setFollowUpAtLocal] = useState(() => formatDateTimeLocalInput(inquiry.follow_up_at));
  const [lastContactedLocal, setLastContactedLocal] = useState(() => formatDateTimeLocalInput(inquiry.last_contacted_at));
  const [isSavingOpsMeta, setIsSavingOpsMeta] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const prevExternalBumpRef = useRef(0);

  useEffect(() => {
    const b = externalTimelineBump ?? 0;
    if (b === 0) return;
    if (b === prevExternalBumpRef.current) return;
    prevExternalBumpRef.current = b;
    setActivityRefreshKey((k) => k + 1);
  }, [externalTimelineBump]);

  const triggerCopyFlash = useCallback((key: Exclude<CopyFlash, null>) => {
    setCopyFlash(key);
    window.setTimeout(() => setCopyFlash((c) => (c === key ? null : c)), 2000);
  }, []);

  const logClientActivity = useCallback(
    async (
      activity_type: "template_copied" | "manual_log",
      summary: string,
      metadata?: Record<string, unknown> | null,
    ) => {
      try {
        const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}/activity-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activity_type, summary, metadata: metadata ?? null }),
        });
        if (res.ok) setActivityRefreshKey((k) => k + 1);
      } catch {
        /* 복사는 이미 성공했으므로 로그 실패는 무시 */
      }
    },
    [inquiry.id],
  );

  useEffect(() => {
    const gt = inferInquiryType((inquiry.content ?? "").trim(), inquiry.product_title);
    const defaults = getDefaultChecklist(gt);
    setChecklist(mergeStoredChecklist(defaults, inquiry.response_checklist ?? undefined));
    setNote(inquiry.response_note ?? "");
    setStage(inquiry.response_stage ?? "initial_response");
    setSavedAtDisplay(inquiry.response_updated_at ?? null);
    setIsDirty(false);
  }, [inquiry.id, inquiry.response_updated_at]);

  useEffect(() => {
    prevExternalBumpRef.current = 0;
  }, [inquiry.id]);

  useEffect(() => {
    setAssigneeName(inquiry.assignee_name ?? "");
    setLeadPriority(inquiry.lead_priority ?? "");
    setNextAction(inquiry.next_action ?? "");
    setFollowUpAtLocal(formatDateTimeLocalInput(inquiry.follow_up_at));
    setLastContactedLocal(formatDateTimeLocalInput(inquiry.last_contacted_at));
  }, [
    inquiry.id,
    inquiry.assignee_name,
    inquiry.lead_priority,
    inquiry.next_action,
    inquiry.follow_up_at,
    inquiry.last_contacted_at,
  ]);

  const handleCopyFirst = useCallback(async () => {
    setCopyError(null);
    const ok = await copyTextToClipboard(analysis.generatedMessage);
    if (ok) triggerCopyFlash("first");
    else {
      setCopyError("복사에 실패했습니다. 메시지를 직접 선택해 복사해 주세요.");
      window.alert("클립보드 복사에 실패했습니다. 미리보기 영역에서 직접 복사해 주세요.");
    }
  }, [analysis.generatedMessage, triggerCopyFlash]);

  const handleCopyTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    setCopyError(null);
    const text = selectedTemplate.build(inquiry);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      triggerCopyFlash("template");
      void logClientActivity("template_copied", `응대 템플릿 복사: ${selectedTemplate.title}`, {
        copied_template_id: selectedTemplate.id,
      });
    } else window.alert("복사에 실패했습니다. 미리보기를 직접 선택해 복사해 주세요.");
  }, [selectedTemplate, inquiry, triggerCopyFlash, logClientActivity]);

  const handleCopyPhone = useCallback(async () => {
    if (!phoneScript) return;
    setCopyError(null);
    const text = formatPhoneScriptFull(phoneScript);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      triggerCopyFlash("phone");
      void logClientActivity("manual_log", "전화 스크립트 전체 복사", { kind: "phone_script" });
    } else window.alert("복사에 실패했습니다.");
  }, [phoneScript, triggerCopyFlash, logClientActivity]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}/response-guide`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_checklist: checklist,
          response_note: note,
          response_stage: stage,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; inquiry?: Inquiry };
      if (!res.ok) {
        window.alert(payload.message ?? "저장에 실패했습니다.");
        return;
      }
      if (payload.inquiry) {
        onSaved?.(payload.inquiry);
        const at = payload.inquiry.response_updated_at ?? null;
        if (at) setSavedAtDisplay(at);
        setIsDirty(false);
        setActivityRefreshKey((k) => k + 1);
      }
    } catch {
      window.alert("저장 요청 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }, [checklist, note, stage, inquiry.id, onSaved]);

  const opsDirty = useMemo(() => {
    const bn = inquiry.assignee_name ?? "";
    const bp = inquiry.lead_priority ?? "";
    const ba = inquiry.next_action ?? "";
    const bf = formatDateTimeLocalInput(inquiry.follow_up_at);
    const bl = formatDateTimeLocalInput(inquiry.last_contacted_at);
    return (
      assigneeName.trim() !== bn.trim() ||
      (leadPriority || "") !== bp ||
      nextAction.trim() !== ba.trim() ||
      followUpAtLocal.trim() !== bf.trim() ||
      lastContactedLocal.trim() !== bl.trim()
    );
  }, [
    inquiry.assignee_name,
    inquiry.lead_priority,
    inquiry.next_action,
    inquiry.follow_up_at,
    inquiry.last_contacted_at,
    assigneeName,
    leadPriority,
    nextAction,
    followUpAtLocal,
    lastContactedLocal,
  ]);

  const handleSaveOpsMeta = useCallback(async () => {
    if (!opsDirty) return;
    const followIso =
      followUpAtLocal.trim() === "" ? null : parseDateTimeLocalToIso(followUpAtLocal);
    const contactedIso =
      lastContactedLocal.trim() === "" ? null : parseDateTimeLocalToIso(lastContactedLocal);
    if (followUpAtLocal.trim() !== "" && followIso === null) {
      window.alert("팔로업 일시 형식이 올바르지 않습니다.");
      return;
    }
    if (lastContactedLocal.trim() !== "" && contactedIso === null) {
      window.alert("마지막 연락 시각 형식이 올바르지 않습니다.");
      return;
    }
    setIsSavingOpsMeta(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}/ops-meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_name: assigneeName.trim() === "" ? null : assigneeName.trim(),
          lead_priority: leadPriority === "" ? null : leadPriority,
          next_action: nextAction.trim() === "" ? null : nextAction.trim(),
          follow_up_at: followIso,
          last_contacted_at: contactedIso,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; inquiry?: Inquiry };
      if (!res.ok) {
        window.alert(payload.message ?? "운영 정보 저장에 실패했습니다.");
        return;
      }
      if (payload.inquiry) {
        onSaved?.(payload.inquiry);
        setActivityRefreshKey((k) => k + 1);
      }
    } catch {
      window.alert("운영 정보 저장 요청 중 오류가 발생했습니다.");
    } finally {
      setIsSavingOpsMeta(false);
    }
  }, [
    opsDirty,
    assigneeName,
    leadPriority,
    nextAction,
    followUpAtLocal,
    lastContactedLocal,
    inquiry.id,
    onSaved,
  ]);

  const checklistKeys = useMemo(() => Object.keys(checklist), [checklist]);

  const showProposal = proposalGuide && proposalGuide.bullets.length > 0;
  const showAlternative = alternativeStrategy && alternativeStrategy.bullets.length > 0;

  const assigneeBadges = (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {assigneeName.trim() ? (
        <span className="inline-flex rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
          담당: {assigneeName.trim()}
        </span>
      ) : null}
      {leadPriority ? (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${leadPriorityBadgeClass(
            getLeadPriorityTone(leadPriority),
          )}`}
        >
          우선순위 {getLeadPriorityLabel(leadPriority)}
        </span>
      ) : null}
    </div>
  );

  const messagingColumn = (
    <div className="space-y-3">
      <header className="px-0.5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">응대 매뉴얼</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">문의 유형별 기본 가이드 · 메시지·스크립트</p>
        {assigneeBadges}
      </header>

      <SectionCard title="응대 분석">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
            {analysis.typeLabel}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${leadBadgeClass(analysis.leadTemperature)}`}>
            리드 {analysis.leadTemperatureLabel}
          </span>
        </div>
        <dl className="mt-2 space-y-1.5 text-xs text-[var(--text-secondary)]">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="font-medium text-[var(--text-muted)]">추천 대응 속도</dt>
            <dd>{analysis.responseSpeedLabel}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="font-medium text-[var(--text-muted)]">추천 대응 방식</dt>
            <dd>{analysis.responseChannelLabel}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="1차 응대">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopyFirst()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--border)]/40"
          >
            {copyFlash === "first" ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
            {copyFlash === "first" ? "복사됨" : "1차 응대 메시지 복사"}
          </button>
          {onUseAsMessageDraft ? (
            <button
              type="button"
              onClick={() => onUseAsMessageDraft(analysis.generatedMessage)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]/80"
            >
              문자 편집기로 넣기
            </button>
          ) : null}
        </div>
        {copyError ? <p className="mt-1.5 text-xs text-[var(--danger)]">{copyError}</p> : null}
        <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
          {analysis.generatedMessage}
        </p>
      </SectionCard>

      {templates.length > 0 ? (
        <SectionCard title="응대 템플릿">
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplateId(t.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  selectedTemplateId === t.id
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--border)]/30"
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>
          {selectedTemplate ? (
            <>
              {selectedTemplate.description ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">{selectedTemplate.description}</p>
              ) : null}
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
                {selectedTemplate.build(inquiry)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleCopyTemplate()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--border)]/40"
                >
                  {copyFlash === "template" ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copyFlash === "template" ? "복사됨" : "템플릿 복사"}
                </button>
                {onUseAsMessageDraft ? (
                  <button
                    type="button"
                    onClick={() => onUseAsMessageDraft(selectedTemplate.build(inquiry))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]/80"
                  >
                    문자 편집기로 넣기
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {phoneScript ? (
        <SectionCard title="전화 스크립트">
          <div className="space-y-2 text-xs text-[var(--text-secondary)]">
            <div>
              <p className="font-semibold text-[var(--text-muted)]">오프닝</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {phoneScript.opening.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-muted)]">핵심 질문</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {phoneScript.questions.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-muted)]">마무리</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {phoneScript.closing.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopyPhone()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--border)]/40"
            >
              {copyFlash === "phone" ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
              {copyFlash === "phone" ? "복사됨" : "전체 복사"}
            </button>
            {onUseAsMessageDraft && phoneScript ? (
              <button
                type="button"
                onClick={() => onUseAsMessageDraft(formatPhoneScriptFull(phoneScript))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]/80"
              >
                문자 편집기로 넣기
              </button>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {showProposal && proposalGuide ? (
        <SectionCard title="제안 가이드">
          <ul className="list-inside list-disc space-y-1 text-xs text-[var(--text-secondary)]">
            {proposalGuide.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {showAlternative && alternativeStrategy ? (
        <SectionCard title="대체안 전략">
          <ul className="list-inside list-disc space-y-1 text-xs text-[var(--text-secondary)]">
            {alternativeStrategy.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="주의사항">
        <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
          {analysis.cautionItems.map((item) => (
            <li
              key={item}
              className="flex gap-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-bg)]/40 px-2 py-1.5 text-[var(--danger)] dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200"
            >
              <span className="mt-0.5 shrink-0 font-bold">!</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );

  const opsSections = (
    <>
      <SectionCard title="필수 확인 항목">
        <ul className="space-y-2 text-xs text-[var(--text-primary)]">
          {checklistKeys.map((key) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)]"
                  checked={checklist[key] ?? false}
                  onChange={(e) => {
                    setChecklist((prev) => ({ ...prev, [key]: e.target.checked }));
                    setIsDirty(true);
                  }}
                />
                <span>{getChecklistLabel(key)} 확인</span>
              </label>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="진행 단계">
        <label className="block text-xs font-medium text-[var(--text-muted)]">현재 단계</label>
        <select
          value={stage}
          onChange={(e) => {
            setStage(e.target.value as InquiryResponseStage);
            setIsDirty(true);
          }}
          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
        >
          {INQUIRY_RESPONSE_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </SectionCard>

      <SectionCard title="내부 메모">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setIsDirty(true);
          }}
          rows={4}
          placeholder="팀 내부에서만 공유하는 메모"
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
        />
      </SectionCard>

      <SectionCard title="저장">
        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={() => void handleSave()}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--border)]/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          저장
        </button>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {isSaving ? "저장 중…" : null}
          {!isSaving && isDirty ? "저장되지 않은 변경이 있습니다." : null}
          {!isSaving && !isDirty && savedAtDisplay ? `저장됨 (${formatShortClock(savedAtDisplay)})` : null}
          {!isSaving && !isDirty && !savedAtDisplay ? "아직 저장된 적 없습니다." : null}
        </p>
      </SectionCard>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--text-secondary)]">
        응대 도구 마지막 저장: {savedAtDisplay ? formatFullDateTime(savedAtDisplay) : "—"}
      </div>

      <SectionCard title="담당자 / 우선순위">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)]">담당자 이름</label>
            <input
              type="text"
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="예: 홍길동"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)]">리드 우선순위</label>
            <select
              value={leadPriority}
              onChange={(e) => setLeadPriority(e.target.value as InquiryLeadPriority | "")}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
            >
              <option value="">미지정</option>
              {INQUIRY_LEAD_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {getLeadPriorityLabel(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="다음 액션 / 팔로업">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)]">다음 액션</label>
            <textarea
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              rows={2}
              placeholder="예: 랜드사 가능 여부 확인 후 고객 회신"
              className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)]">팔로업 예정</label>
            <input
              type="datetime-local"
              value={followUpAtLocal}
              onChange={(e) => setFollowUpAtLocal(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)]">마지막 고객 연락</label>
            <input
              type="datetime-local"
              value={lastContactedLocal}
              onChange={(e) => setLastContactedLocal(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <button
            type="button"
            disabled={!opsDirty || isSavingOpsMeta}
            onClick={() => void handleSaveOpsMeta()}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--border)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            운영 정보 저장
          </button>
          <p className="text-xs text-[var(--text-muted)]">
            {isSavingOpsMeta ? "저장 중…" : null}
            {!isSavingOpsMeta && opsDirty ? "저장되지 않은 운영 정보가 있습니다." : null}
            {!isSavingOpsMeta && !opsDirty ? "운영 정보가 저장된 상태와 동일합니다." : null}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="활동 히스토리">
        <InquiryActivityTimeline inquiryId={inquiry.id} refreshKey={activityRefreshKey} />
      </SectionCard>
    </>
  );

  const opsColumn = (
    <div className="space-y-3">
      <header className="px-0.5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">운영 · 진행</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">체크리스트·단계·담당·활동 이력</p>
      </header>
      {opsSections}
    </div>
  );

  if (layout === "split") {
    return (
      <>
        <aside className={SPLIT_COLUMN_CLASS}>{messagingColumn}</aside>
        <aside className={`${SPLIT_COLUMN_CLASS} bg-[var(--surface-muted)]/20`}>{opsColumn}</aside>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {messagingColumn}
      {opsSections}
    </div>
  );
}
