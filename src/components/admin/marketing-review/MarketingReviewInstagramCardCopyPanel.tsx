"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import AdminCard from "@/components/admin/ui/AdminCard";
import { adminToneText } from "@/components/admin/ui/adminStatusTone";
import { cn } from "@/lib/cn";
import type {
  InstagramCardCopyFields,
  InstagramCardCopyReviewGateState,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import type { InstagramCardCopyReviewView } from "@/lib/marketing/review/instagramCardCopyReview";

type FieldKey = keyof InstagramCardCopyFields;
type DraftFields = Record<FieldKey, string>;

const FIELD_LABELS: Record<FieldKey, string> = {
  kicker: "키커",
  headline: "헤드라인",
  body: "본문",
  microcopy: "마이크로카피",
};

const FIELD_GUIDES: Record<FieldKey, { description: string; example: string }> = {
  kicker: {
    description: "헤드라인 위에 작게 표시하는 맥락 안내입니다. 주제·장소·전환점을 짧게 적으세요. 선택 항목입니다.",
    example: "고치도 움직였습니다",
  },
  headline: {
    description: "카드에서 가장 크게 보이는 핵심 문장입니다. 한 장에서 전할 메시지 하나를 담으세요.",
    example: "물 들어올 때 노 저어야죠",
  },
  body: {
    description: "헤드라인 아래의 본문입니다. 핵심 문장을 이해할 수 있도록 사실·이유·이야기를 풀어주세요.",
    example: "한국인 관광객이 빠르게 늘자 고치현도 한국 노선 유치에 나서고 있습니다.",
  },
  microcopy: {
    description: "본문 아래에 작게 붙이는 보충 문구입니다. 짧은 덧붙임·질문·저장·팔로우 안내에 쓰세요. 선택 항목입니다.",
    example: "다음 일본 여행을 위해 저장해 두세요.",
  },
};

const GATE_LABELS: Record<InstagramCardCopyReviewGateState, string> = {
  not_applicable: "대상 아님",
  review_missing: "검토 전",
  pending: "승인 대기",
  base_changed: "원본 변경됨",
  approved_stale: "재승인 필요",
  approved: "승인됨",
};

function toDraft(fields: InstagramCardCopyFields): DraftFields {
  return {
    kicker: fields.kicker ?? "",
    headline: fields.headline,
    body: fields.body ?? "",
    microcopy: fields.microcopy ?? "",
  };
}

function sameDraft(a: DraftFields, b: DraftFields): boolean {
  return (Object.keys(FIELD_LABELS) as FieldKey[]).every((key) => a[key].trim() === b[key].trim());
}

/**
 * Instagram card-by-card copy review. Approval here is what unblocks VRA / Shared Visual Plan /
 * cardnews render; it is separate from the Instagram caption approval in the channel tabs.
 */
export function MarketingReviewInstagramCardCopyPanel(props: {
  candidateId: string;
  canEdit: boolean;
  /** Bumped when the Instagram slot is replaced elsewhere (e.g. cardnews JSON import). */
  refreshKey?: number;
  onStatusChange?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { candidateId, canEdit, refreshKey = 0, onDirtyChange } = props;
  const [view, setView] = useState<InstagramCardCopyReviewView | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>({});
  const [coverTitleDraft, setCoverTitleDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null | undefined>(undefined);

  const apply = useCallback((next: InstagramCardCopyReviewView) => {
    setView(next);
    setDrafts(
      Object.fromEntries(
        (next.review?.cards ?? []).map((card) => [card.cardId, toDraft(card.humanDraft ?? card.aiDraft)]),
      ),
    );
    setCoverTitleDraft(next.review?.instagramCoverTitleKo ?? "");
  }, []);

  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/instagram-card-copy-review`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = (await res.json()) as InstagramCardCopyReviewView & { message?: string };
      if (!res.ok) {
        setMessage(data.message ?? "카드 문구 검토 상태를 불러오지 못했습니다.");
        return;
      }
      apply(data);
      setMessage(null);
    } catch {
      setMessage("카드 문구 검토 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [apply, endpoint]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const savedDrafts = useMemo(
    () =>
      Object.fromEntries(
        (view?.review?.cards ?? []).map((card) => [card.cardId, toDraft(card.humanDraft ?? card.aiDraft)]),
      ) as Record<string, DraftFields>,
    [view],
  );
  const cardsDirty = Object.entries(drafts).some(
    ([cardId, draft]) => savedDrafts[cardId] && !sameDraft(draft, savedDrafts[cardId]),
  );
  const savedCoverTitle = view?.review?.instagramCoverTitleKo ?? "";
  const coverTitleDirty = coverTitleDraft.trim() !== savedCoverTitle.trim();
  const dirty = cardsDirty || coverTitleDirty;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  async function post(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as InstagramCardCopyReviewView & { message?: string };
      if (!res.ok) {
        setMessage(data.message ?? "요청 처리에 실패했습니다.");
        return;
      }
      apply(data);
      setMessage(success);
      props.onStatusChange?.();
    } catch {
      setMessage("요청 처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !view) return null;
  if (!view?.applicable || !view.review) return null;

  const editable = canEdit && !busy && !view.staleHumanEdits;
  const limits = view.limits;

  return (
    <AdminCard className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Instagram 카드 문구 검토 · {view.review.cards.length}장</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">가져온 카드 구성 전체를 표시합니다. 현재 화면에서는 문구를 수정하며, 카드 수와 순서는 생성·가져오기 단계에서 결정됩니다.</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            카드별 문구를 확인·수정한 뒤 저장·승인해야 Shared Visual Plan, Astra 요청문 생성과 카드뉴스 렌더가
            진행됩니다. 승인 후 문구만 고친 경우 이미지 재생성 없이 기존 업로드 이미지로 렌더합니다. 캡션 승인과는
            별개이며, 원본 생성 문구는 그대로 보존됩니다.
          </p>
        </div>
        <span
          className={cn(
            "rounded-lg border border-[var(--border)] px-3 py-1 text-sm",
            view.gateState === "approved" ? adminToneText.success : adminToneText.warning,
          )}
        >
          {GATE_LABELS[view.gateState]}
        </span>
      </div>

      <details className="rounded-lg border border-[var(--border)] p-3 text-sm">
        <summary className="cursor-pointer font-medium">키커·헤드라인·본문·마이크로카피, 어떻게 쓰나요?</summary>
        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          카드의 읽는 순서는 키커 → 헤드라인 → 본문 → 마이크로카피입니다. 키커와 마이크로카피는 필요할 때만
          쓰세요. 비워두면 해당 문구의 자리도 생략됩니다. 본문을 작은 글씨로 옮기기보다 핵심 설명은 본문에 남겨주세요.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => (
            <div key={key} className="rounded-lg bg-[var(--surface)] p-3">
              <dt className="font-medium">{FIELD_LABELS[key]}</dt>
              <dd className="mt-1 text-xs text-[var(--text-secondary)]">
                {FIELD_GUIDES[key].description}
                <span className="mt-1 block">예: {FIELD_GUIDES[key].example}</span>
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {view.staleHumanEdits ? (
        <p className={cn("text-sm", adminToneText.warning)}>
          생성된 카드 문구가 바뀌어 이전 수정본을 적용할 수 없습니다. 「AI 초안으로 초기화」 후 다시 검토하세요.
        </p>
      ) : null}

      <label className="block space-y-1 rounded-lg border border-[var(--border)] p-3 text-sm">
        <span className="flex justify-between text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Instagram 카드뉴스 썸네일 제목</span>
          <span className={coverTitleDraft.trim().length > view.coverTitleMaxLength ? adminToneText.danger : undefined}>
            {coverTitleDraft.trim().length}/{view.coverTitleMaxLength}
          </span>
        </span>
        <span className="block text-xs text-[var(--text-secondary)]">
          1:1 카드뉴스 첫 장의 썸네일 전용 제목입니다. 카드 헤드라인·본문과 별개이며, 비워두면 썸네일 이미지를 따로
          만들지 않습니다.
        </span>
        <input
          value={coverTitleDraft}
          disabled={!editable}
          onChange={(e) => setCoverTitleDraft(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
        {view.suggestedCoverTitleKo && view.suggestedCoverTitleKo !== coverTitleDraft.trim() ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>ChatGPT 제안: {view.suggestedCoverTitleKo}</span>
            <AdminButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={!editable}
              onClick={(e) => {
                e.preventDefault();
                setCoverTitleDraft(view.suggestedCoverTitleKo ?? "");
              }}
            >
              제안 적용
            </AdminButton>
          </span>
        ) : null}
      </label>

      <ol className="space-y-4">
        {view.review.cards.map((card, index) => {
          const draft = drafts[card.cardId] ?? toDraft(card.aiDraft);
          const edited = !sameDraft(draft, toDraft(card.aiDraft));
          return (
            <li key={card.cardId}>
              <details className="space-y-2 rounded-lg border border-[var(--border)] p-3"
                open={expandedCardId === undefined ? index === 0 : expandedCardId === card.cardId}
                onToggle={(event) => {
                  if (event.currentTarget.open) setExpandedCardId(card.cardId);
                  else setExpandedCardId((current) => current === card.cardId ? null : current);
                }}>
                <summary className="cursor-pointer text-sm font-medium">{index + 1}. {draft.headline || "제목 없음"} <span className="ml-2 text-xs text-[var(--text-secondary)]">{edited ? "수정본" : "AI 초안"}{savedDrafts[card.cardId] && !sameDraft(draft, savedDrafts[card.cardId]) ? " · 저장 필요" : ""}</span></summary>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                <span>
                  {index + 1}. <span className="font-mono">{card.cardId}</span>
                  {card.role ? ` · ${card.role}` : ""}
                  {card.evidenceRefs.length ? ` · 근거 ${card.evidenceRefs.length}` : ""}
                </span>
                {edited ? <span className={adminToneText.warning}>사람 수정</span> : null}
              </div>
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => {
                const value = draft[key];
                const over = value.trim().length > limits[key];
                const aiValue = toDraft(card.aiDraft)[key];
                return (
                  <label key={key} className="block text-sm">
                    <span className="mb-1 flex justify-between text-[var(--text-secondary)]">
                      <span>{FIELD_LABELS[key]}</span>
                      <span className={over ? adminToneText.danger : undefined}>
                        {value.trim().length}/{limits[key]}
                      </span>
                    </span>
                    <span id={`cardcopy-${card.cardId}-${key}-help`} className="mb-2 block text-xs text-[var(--text-secondary)]">
                      {FIELD_GUIDES[key].description}
                    </span>
                    {key === "body" ? (
                      <textarea
                        aria-label={`${index + 1}번 카드 ${FIELD_LABELS[key]}`}
                        aria-describedby={`cardcopy-${card.cardId}-${key}-help`}
                        value={value}
                        rows={3}
                        disabled={!editable}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [card.cardId]: { ...draft, [key]: e.target.value } }))
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                      />
                    ) : (
                      <input
                        aria-label={`${index + 1}번 카드 ${FIELD_LABELS[key]}`}
                        aria-describedby={`cardcopy-${card.cardId}-${key}-help`}
                        value={value}
                        disabled={!editable}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [card.cardId]: { ...draft, [key]: e.target.value } }))
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                      />
                    )}
                    {value.trim() !== aiValue.trim() ? (
                      <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                        AI 초안: {aiValue || "(비어 있음)"}
                      </span>
                    ) : null}
                  </label>
                );
              })}
              </details>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
        <AdminButton
          type="button"
          disabled={!editable || !dirty}
          onClick={() =>
            void post(
              {
                action: "save",
                cards: Object.entries(drafts).map(([cardId, draft]) => ({ cardId, ...draft })),
                instagramCoverTitleKo: coverTitleDraft.trim() || null,
              },
              "카드 문구를 저장했습니다. 승인 전까지 렌더와 Shared Visual Plan 생성은 막혀 있습니다.",
            )
          }
        >
          저장
        </AdminButton>
        <AdminButton
          type="button"
          disabled={!editable || dirty || view.gateState === "approved"}
          onClick={() =>
            void post(
              { action: "approve" },
              "카드 문구를 승인했습니다. 기존 업로드 이미지로 바로 카드뉴스를 다시 렌더할 수 있습니다.",
            )
          }
        >
          카드 문구 승인
        </AdminButton>
        <AdminButton
          type="button"
          variant="secondary"
          disabled={!canEdit || busy}
          onClick={() => void post({ action: "reset" }, "AI 초안으로 초기화했습니다.")}
        >
          AI 초안으로 초기화
        </AdminButton>
      </div>
      {dirty ? (
        <p className="text-xs text-[var(--text-secondary)]">저장하지 않은 수정이 있습니다. 저장 후 승인하세요.</p>
      ) : null}
      {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
    </AdminCard>
  );
}
