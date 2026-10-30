"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { startOAuthLogin } from "@/lib/auth/oauthStart";
import { fetchPlannerMemberAuthenticated } from "@/lib/planner/saveClient";
import { postPlannerSessionClaim } from "@/lib/planner/claimClient";
import { setPlannerContinuationIntent } from "@/lib/planner/continuationIntent";
import {
  trackPlannerGuestPlanClaimed,
  trackPlannerGuestPlanClaimFailed,
} from "@/lib/analytics/trackPlannerEvents";

type PlannerContinuationBannerProps = {
  sessionId: string;
  onClaimed: (meta: { updatedAt: string; claimed: boolean }) => void;
};

/**
 * Guest generated plan: ownership attach only (status stays generated).
 * Distinct from Save CTA / saveIntent.
 */
export function PlannerContinuationBanner({
  sessionId,
  onClaimed,
}: PlannerContinuationBannerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const loggedIn = await fetchPlannerMemberAuthenticated();
      if (!loggedIn) {
        setPlannerContinuationIntent(sessionId);
        startOAuthLogin("kakao", { nextPath: `/planner/${sessionId}` });
        return;
      }

      const result = await postPlannerSessionClaim(sessionId);
      if (!result.ok) {
        trackPlannerGuestPlanClaimFailed({ sessionId, source: "banner" });
        if (result.status === 401) {
          setPlannerContinuationIntent(sessionId);
          startOAuthLogin("kakao", { nextPath: `/planner/${sessionId}` });
          return;
        }
        setError(
          "이 플랜을 계정에 연결하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
        );
        return;
      }

      trackPlannerGuestPlanClaimed({ sessionId, source: "banner" });
      onClaimed({ updatedAt: result.session.updatedAt, claimed: result.claimed });
    } catch {
      trackPlannerGuestPlanClaimFailed({ sessionId, source: "banner" });
      setError(
        "이 플랜을 계정에 연결하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, onClaimed, sessionId]);

  return (
    <div
      className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-3"
      data-testid="planner-continuation-banner"
    >
      <p className="type-small text-[var(--text-secondary)]">
        로그인하면 이 플랜을 계정에 연결해 다른 기기에서도 이어볼 수 있어요.
      </p>
      <Button
        type="button"
        variant="kakao"
        className="w-full min-h-[44px]"
        loading={busy}
        onClick={() => void onContinue()}
      >
        카카오로 로그인하고 이어보기
      </Button>
      {error ? (
        <p className="type-small text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
