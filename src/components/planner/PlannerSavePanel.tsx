"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { startOAuthLogin } from "@/lib/auth/oauthStart";
import {
  trackPlannerKakaoLoginStarted,
  trackPlannerSaveClicked,
  trackPlannerSaved,
} from "@/lib/analytics/trackPlannerEvents";
import {
  fetchPlannerMemberAuthenticated,
  postPlannerSessionSave,
} from "@/lib/planner/saveClient";
import { clearPlannerSaveIntent, setPlannerSaveIntent } from "@/lib/planner/saveIntent";

type PlannerSavePanelProps = {
  sessionId: string;
  destination: string;
  sourceProductId: string | null;
  isSaved: boolean;
  onSaved: () => void;
};

export function PlannerSavePanel({
  sessionId,
  destination,
  sourceProductId,
  isSaved,
  onSaved,
}: PlannerSavePanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (isSaved) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="type-body font-medium text-[var(--foreground)]">✓ 저장됨</p>
        <p className="mt-1 type-caption text-[var(--text-muted)]">
          같은 계정으로 로그인하면 다른 기기에서도 이 플랜을 볼 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <Button
          type="button"
          variant="primary"
          className="w-full sm:w-auto"
          loading={saving}
          onClick={() => void onClickSave()}
        >
          이 플랜 저장하기
        </Button>
        {error ? (
          <p className="type-small text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : (
          <p className="type-caption text-[var(--text-muted)]">
            저장하면 다른 기기에서도 다시 확인할 수 있어요.
          </p>
        )}
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
