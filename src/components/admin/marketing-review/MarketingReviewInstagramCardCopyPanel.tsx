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
export function MarketingReviewInstagramCardCopyPanel(props: { candidateId: string; canEdit: boolean }) {
  const { candidateId, canEdit } = props;
  const [view, setView] = useState<InstagramCardCopyReviewView | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>({});
  const [coverTitleDraft, setCoverTitleDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  }, [load]);

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
          <h2 className="text-base font-semibold">Instagram 카드 문구 검토</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            카드별 문구를 확인·수정한 뒤 승인해야 Shared Visual Plan 생성과 카드뉴스 렌더가 진행됩니다. 문구만
            고친 경우 이미지 재생성 없이 기존 업로드 이미지로 렌더합니다. 캡션 승인과는 별개이며, 원본 생성 문구는
            그대로 보존됩니다.
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
      </label>

      <ol className="space-y-4">
        {view.review.cards.map((card, index) => {
          const draft = drafts[card.cardId] ?? toDraft(card.aiDraft);
          const edited = !sameDraft(draft, toDraft(card.aiDraft));
          return (
            <li key={card.cardId} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
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
                    {key === "body" ? (
                      <textarea
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
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
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
