import { NextResponse } from "next/server";
import { getNextKstMidnightUtcIso } from "@/lib/planner/quota/kst";
import type {
  PlannerQuotaBlockedReason,
  PlannerQuotaErrorCode,
  PlannerQuotaSubject,
  ReservePlannerQuotaResult,
} from "@/lib/planner/quota/types";

export function mapReserveResultToBlocked(params: {
  subject: PlannerQuotaSubject;
  result: Exclude<ReservePlannerQuotaResult, "reserved">;
}): {
  code: PlannerQuotaErrorCode;
  status: 409 | 429;
  reason: PlannerQuotaBlockedReason;
  message: string;
  nextAvailableAt?: string;
} {
  if (params.result === "already_reserved") {
    return {
      code: "GENERATION_ALREADY_IN_PROGRESS",
      status: 409,
      reason: "already_in_progress",
      message: "여행 플랜 생성이 이미 진행 중입니다. 잠시만 기다려 주세요.",
    };
  }

  if (params.subject.subjectType === "member") {
    return {
      code: "AI_DAILY_QUOTA_EXCEEDED",
      status: 429,
      reason: "daily_exceeded",
      message: "오늘의 AI 플랜 생성권을 모두 사용했어요. 내일 00시에 다시 이용할 수 있습니다.",
      nextAvailableAt: getNextKstMidnightUtcIso(),
    };
  }

  return {
    code: "ANONYMOUS_LIFETIME_QUOTA_EXCEEDED",
    status: 429,
    reason: "lifetime_exceeded",
    message:
      "비회원은 이 기기에서 AI 여행 플랜을 1회 만들 수 있어요. 카카오로 로그인하면 매일 새로운 여행 플랜을 1회 만들 수 있습니다.",
  };
}

export function quotaBlockedResponse(params: {
  subject: PlannerQuotaSubject;
  result: Exclude<ReservePlannerQuotaResult, "reserved">;
}): NextResponse {
  const mapped = mapReserveResultToBlocked(params);
  return NextResponse.json(
    {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.nextAvailableAt ? { nextAvailableAt: mapped.nextAvailableAt } : {}),
    },
    { status: mapped.status },
  );
}
