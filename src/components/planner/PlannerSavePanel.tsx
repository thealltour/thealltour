"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { startOAuthLogin } from "@/lib/auth/oauthStart";
import {
  trackPlannerKakaoCalendarClicked,
  trackPlannerKakaoCalendarOAuthStarted,
  trackPlannerKakaoLoginStarted,
  trackPlannerKakaoMemoClicked,
  trackPlannerKakaoMemoOAuthStarted,
  trackPlannerSaveClicked,
  trackPlannerSaved,
} from "@/lib/analytics/trackPlannerEvents";
import {
  fetchPlannerMemberAuthenticated,
  postPlannerSessionSave,
} from "@/lib/planner/saveClient";
import { clearPlannerSaveIntent, setPlannerSaveIntent } from "@/lib/planner/saveIntent";
import { PLANNER_SAVED_LIST_PATH } from "@/lib/planner/memberAccountNav";
import {
  parsePlannerKakaoMemoQuery,
  PLANNER_KAKAO_MEMO_QUERY,
  type PlannerKakaoMemoQueryStatus,
} from "@/lib/auth/kakao/plannerKakaoMemoQuery";
import {
  parsePlannerKakaoCalendarQuery,
  PLANNER_KAKAO_CALENDAR_QUERY,
  type PlannerKakaoCalendarQueryStatus,
} from "@/lib/auth/kakao/plannerKakaoCalendarQuery";

type PlannerSavePanelProps = {
  sessionId: string;
  destination: string;
  sourceProductId: string | null;
  isSaved: boolean;
  onSaved: () => void;
  /** Tighter layout for Result action group (behavior unchanged). */
  compact?: boolean;
};

export function PlannerSavePanel({
  sessionId,
  destination,
  sourceProductId,
  isSaved,
  onSaved,
  compact = false,
}: PlannerSavePanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoStatus, setMemoStatus] = useState<PlannerKakaoMemoQueryStatus | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<PlannerKakaoCalendarQueryStatus | null>(
    null,
  );
  const [memoStarting, setMemoStarting] = useState(false);
  const [calendarStarting, setCalendarStarting] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const memoParsed = parsePlannerKakaoMemoQuery(searchParams.get(PLANNER_KAKAO_MEMO_QUERY));
    const calendarParsed = parsePlannerKakaoCalendarQuery(
      searchParams.get(PLANNER_KAKAO_CALENDAR_QUERY),
    );
    if (!memoParsed && !calendarParsed) return;

    if (memoParsed) setMemoStatus(memoParsed);
    if (calendarParsed) setCalendarStatus(calendarParsed);

    const next = new URLSearchParams(searchParams.toString());
    next.delete(PLANNER_KAKAO_MEMO_QUERY);
    next.delete(PLANNER_KAKAO_CALENDAR_QUERY);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleSaveSuccess = useCallback(
    (wasAlreadyLoggedIn: boolean, saveMethod: "kakao" | "existing_member") => {
      clearPlannerSaveIntent();
      trackPlannerSaved({
        sessionId,
        destination,
        sourceProductId,
        wasAlreadyLoggedIn,
        saveMethod,
      });
      onSaved();
    },
    [destination, onSaved, sessionId, sourceProductId],
  );

  const saveAsLoggedInMember = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await postPlannerSessionSave(sessionId);
      if (!result.ok) {
        setError(result.message ?? "플랜을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      handleSaveSuccess(true, "existing_member");
    } catch {
      setError("플랜을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }, [handleSaveSuccess, sessionId]);

  const onClickSave = useCallback(async () => {
    if (isSaved || saving) return;
    setError(null);
    const loggedIn = await fetchPlannerMemberAuthenticated();
    trackPlannerSaveClicked({
      sessionId,
      destination,
      sourceProductId,
      wasAlreadyLoggedIn: loggedIn,
    });

    if (loggedIn) {
      await saveAsLoggedInMember();
      return;
    }
    setModalOpen(true);
  }, [destination, isSaved, saveAsLoggedInMember, saving, sessionId, sourceProductId]);

  const onKakaoSaveLogin = useCallback(() => {
    setPlannerSaveIntent(sessionId);
    trackPlannerKakaoLoginStarted({
      sessionId,
      destination,
      sourceProductId,
    });
    startOAuthLogin("kakao", { nextPath: `/planner/${sessionId}` });
  }, [destination, sessionId, sourceProductId]);

  const onKakaoMemoClick = useCallback(() => {
    if (memoStarting || calendarStarting) return;
    setMemoStarting(true);
    setMemoStatus(null);
    trackPlannerKakaoMemoClicked({ sessionId, destination, sourceProductId });
    trackPlannerKakaoMemoOAuthStarted({ sessionId, destination, sourceProductId });
    window.location.href = `/api/planner/sessions/${encodeURIComponent(sessionId)}/kakao-memo/start`;
  }, [calendarStarting, destination, memoStarting, sessionId, sourceProductId]);

  const onKakaoCalendarClick = useCallback(() => {
    if (memoStarting || calendarStarting) return;
    setCalendarStarting(true);
    setCalendarStatus(null);
    trackPlannerKakaoCalendarClicked({ sessionId, destination, sourceProductId });
    trackPlannerKakaoCalendarOAuthStarted({ sessionId, destination, sourceProductId });
    window.location.href = `/api/planner/sessions/${encodeURIComponent(sessionId)}/kakao-calendar/start`;
  }, [calendarStarting, destination, memoStarting, sessionId, sourceProductId]);

  if (isSaved) {
    const statusMessage =
      calendarStatus === "added"
        ? "✓ 톡캘린더에 여행 일정을 추가했어요."
        : memoStatus === "sent"
          ? "✓ 카카오톡 '나와의 채팅'으로 보냈어요."
          : "✓ 여행 플랜이 저장됐어요.";

    return (
      <div
        className={
          compact
            ? "space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
            : "space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
        }
      >
        <p className="type-body font-medium text-[var(--foreground)]">{statusMessage}</p>
        {memoStatus === "failed" ? (
          <p className="type-small text-[var(--danger)]" role="alert">
            카카오톡으로 보내지 못했어요. 플랜은 정상적으로 저장되어 있습니다.
          </p>
        ) : null}
        {calendarStatus === "failed" ? (
          <p className="type-small text-[var(--danger)]" role="alert">
            톡캘린더에 일정을 추가하지 못했어요. 저장된 플랜에는 영향이 없습니다.
          </p>
        ) : null}
        {!compact && calendarStatus !== "added" && memoStatus !== "sent" ? (
          <p className="type-caption text-[var(--text-muted)]">
            같은 계정으로 로그인하면 다른 기기에서도 이 플랜을 볼 수 있어요.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {memoStatus !== "sent" ? (
            <Button
              type="button"
              variant="kakao"
              className="w-full min-h-[44px]"
              loading={memoStarting}
              disabled={calendarStarting}
              onClick={onKakaoMemoClick}
            >
              {memoStatus === "failed" ? "다시 보내기" : "카카오톡으로 받아보기"}
            </Button>
          ) : null}
          {calendarStatus !== "added" ? (
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px]"
              loading={calendarStarting}
              disabled={memoStarting}
              onClick={onKakaoCalendarClick}
            >
              {calendarStatus === "failed" ? "다시 추가" : "톡캘린더에 추가"}
            </Button>
          ) : null}
          <Link
            href={PLANNER_SAVED_LIST_PATH}
            className="inline-flex min-h-[44px] items-center justify-center type-small font-medium text-[var(--primary)] underline-offset-2 hover:underline"
          >
            내 여행 플랜 보기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={
          compact
            ? "space-y-1.5"
            : "space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        }
      >
        <Button
          type="button"
          variant="primary"
          className="w-full"
          loading={saving}
          onClick={() => void onClickSave()}
        >
          <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
            {compact ? (
              <Bookmark className="h-4 w-4 shrink-0" aria-hidden={true} />
            ) : null}
            {compact ? "플랜 저장" : "이 플랜 저장하기"}
          </span>
        </Button>
        {error ? (
          <p className="type-small text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : !compact ? (
          <p className="type-caption text-[var(--text-muted)]">
            저장하면 다른 기기에서도 다시 확인할 수 있어요.
          </p>
        ) : null}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        aria-label="플랜 저장을 위한 로그인"
        className="w-full max-w-md space-y-4"
      >
        <div className="space-y-2">
          <h2 className="type-h3 text-[var(--foreground)]">여행 계획을 저장해두세요</h2>
          <p className="type-small text-[var(--text-secondary)]">
            카카오로 로그인하면 이 플랜을 저장하고 다른 기기에서도 다시 확인할 수 있어요.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="kakao" className="w-full" onClick={onKakaoSaveLogin}>
            카카오로 로그인하고 이 플랜 저장하기
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setModalOpen(false)}>
            지금은 괜찮아요
          </Button>
        </div>
      </Modal>
    </>
  );
}
