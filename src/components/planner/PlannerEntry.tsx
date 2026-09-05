"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import AlertCard from "@/components/ui/AlertCard";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import { plannerDestinationSchema } from "@/lib/planner/schemas";
import {
  trackPlannerLandingView,
  trackPlannerStarted,
} from "@/lib/analytics/trackPlannerEvents";

type StartState = "idle" | "success";

export function PlannerEntry() {
  const searchParams = useSearchParams();
  const sourceProductIdRaw = searchParams.get("sourceProductId");
  const sourceProductId =
    sourceProductIdRaw && /^[0-9a-f-]{36}$/i.test(sourceProductIdRaw.trim())
      ? sourceProductIdRaw.trim()
      : null;

  const destinationId = useId();
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startState, setStartState] = useState<StartState>("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    trackPlannerLandingView();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedDest = plannerDestinationSchema.safeParse(destination);
    if (!parsedDest.success) {
      setError(parsedDest.error.issues[0]?.message ?? "목적지를 입력해 주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const anonymousKey = getOrCreatePlannerAnonymousKey();
        const res = await fetch("/api/planner/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anonymousKey,
            destination: parsedDest.data,
            sourceProductId,
          }),
        });

        const data = (await res.json().catch(() => null)) as {
          message?: string;
          session?: { id: string; destination?: string; sourceProductId?: string | null };
        } | null;

        if (!res.ok || !data?.session?.id) {
          setError(data?.message ?? "여행을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }

        trackPlannerStarted({
          sessionId: data.session.id,
          destination: data.session.destination ?? parsedDest.data,
          sourceProductId: data.session.sourceProductId ?? sourceProductId,
        });
        setStartState("success");
      } catch {
        setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8 sm:px-0 sm:py-12">
      <header className="space-y-3 text-center sm:text-left">
        <h1 className="heading-display type-h1 text-[var(--foreground)]">
          여행은 자유롭게.
          <br />
          준비까지 힘들 필요는 없으니까.
        </h1>
        <p className="type-body leading-relaxed text-[var(--text-muted)]">
          가고 싶은 곳과 여행 조건을 알려주시면
          <br className="hidden sm:block" />
          더올투어가 자유여행 계획을 함께 만들어드립니다.
        </p>
      </header>

      {startState === "success" ? (
        <AlertCard variant="info" title="여행 계획이 시작되었습니다">
          <p className="type-body text-[var(--text-secondary)]">
            여행 조건 입력 단계는 다음 업데이트에서 제공됩니다.
          </p>
        </AlertCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField
            id={destinationId}
            label="어디로 떠나고 싶으세요?"
            required
            error={error ?? undefined}
          >
            <Input
              id={destinationId}
              name="destination"
              value={destination}
              onChange={(ev) => {
                setDestination(ev.target.value);
                if (error) setError(null);
              }}
              placeholder="예: 오사카, 다낭, 제주"
              autoComplete="off"
              maxLength={120}
              error={Boolean(error)}
              disabled={isPending}
            />
          </FormField>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending}>
            여행 계획 시작하기
          </Button>
        </form>
      )}
    </div>
  );
}
