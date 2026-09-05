import { z } from "zod";
import {
  PLANNER_DURATION_DAYS_MAX,
  PLANNER_DURATION_DAYS_MIN,
  computeDurationDays,
  isIsoDateYmd,
} from "@/lib/planner/dates";

export const PLANNER_SESSION_STATUSES = ["draft", "generated", "saved"] as const;

export const PLANNER_COMPANION_TYPES = [
  "solo",
  "couple",
  "friends",
  "family",
  "parents",
  "with_children",
] as const;

export const PLANNER_INTERESTS = [
  "food",
  "sightseeing",
  "shopping",
  "relaxation",
  "nature",
  "culture",
  "activity",
  "night_view",
] as const;

export const PLANNER_PACES = ["relaxed", "balanced", "packed"] as const;

export const PLANNER_BUDGET_SCOPES = ["per_person", "total"] as const;

export const PLANNER_DATE_MODES = ["fixed", "flexible"] as const;

export const PLANNER_BUDGET_STYLES = ["budget", "standard", "premium"] as const;

export const plannerSessionStatusSchema = z.enum(PLANNER_SESSION_STATUSES);

/** Opaque UUID-like anonymous key from the browser (not PII). */
export const plannerAnonymousKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "invalid anonymousKey");

/** Natural-language plan edit instruction (client → edit API). */
export const plannerEditInstructionSchema = z
  .string()
  .trim()
  .min(2, "수정 요청을 조금 더 구체적으로 적어 주세요.")
  .max(1000, "수정 요청은 1000자 이내로 입력해 주세요.");

export const plannerEditBodySchema = z
  .object({
    instruction: plannerEditInstructionSchema,
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

export const plannerDestinationTextSchema = z
  .string()
  .trim()
  .min(1, "목적지를 입력해 주세요.")
  .max(120, "목적지는 120자 이내로 입력해 주세요.");

/** @deprecated use plannerDestinationTextSchema — kept for POST body */
export const plannerDestinationSchema = plannerDestinationTextSchema;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");

export const plannerCompanionTypeSchema = z.enum(PLANNER_COMPANION_TYPES);

export const plannerInterestSchema = z.enum(PLANNER_INTERESTS);

export const plannerPaceSchema = z.enum(PLANNER_PACES);

export const plannerBudgetScopeSchema = z.enum(PLANNER_BUDGET_SCOPES);

export const plannerDateModeSchema = z.enum(PLANNER_DATE_MODES);

export const plannerBudgetStyleSchema = z.enum(PLANNER_BUDGET_STYLES);

const durationDaysSchema = z
  .number()
  .int("여행 일수는 정수여야 합니다.")
  .min(PLANNER_DURATION_DAYS_MIN, `여행 일수는 ${PLANNER_DURATION_DAYS_MIN}일 이상이어야 합니다.`)
  .max(PLANNER_DURATION_DAYS_MAX, `여행 일수는 ${PLANNER_DURATION_DAYS_MAX}일 이하로 입력해 주세요.`);

export const plannerDraftDatesSchema = z
  .object({
    mode: plannerDateModeSchema,
    startDate: isoDateSchema.nullable(),
    endDate: isoDateSchema.nullable(),
    durationDays: durationDaysSchema,
  })
  .superRefine((dates, ctx) => {
    if (dates.mode === "fixed") {
      if (!dates.startDate) {
        ctx.addIssue({
          code: "custom",
          message: "출발일을 선택해 주세요.",
          path: ["startDate"],
        });
      }
      if (!dates.endDate) {
        ctx.addIssue({
          code: "custom",
          message: "귀국일을 선택해 주세요.",
          path: ["endDate"],
        });
      }
      if (dates.startDate && dates.endDate && dates.endDate < dates.startDate) {
        ctx.addIssue({
          code: "custom",
          message: "귀국일은 출발일 이후여야 합니다.",
          path: ["endDate"],
        });
      }
      if (dates.startDate && dates.endDate && dates.endDate >= dates.startDate) {
        const expected = computeDurationDays(dates.startDate, dates.endDate);
        if (expected != null && dates.durationDays !== expected) {
          ctx.addIssue({
            code: "custom",
            message: "여행 일수가 선택한 기간과 맞지 않습니다.",
            path: ["durationDays"],
          });
        }
        if (expected != null && (expected < PLANNER_DURATION_DAYS_MIN || expected > PLANNER_DURATION_DAYS_MAX)) {
          ctx.addIssue({
            code: "custom",
            message: `여행 기간은 ${PLANNER_DURATION_DAYS_MIN}~${PLANNER_DURATION_DAYS_MAX}일로 선택해 주세요.`,
            path: ["endDate"],
          });
        }
      }
      return;
    }

    // flexible
    if (dates.startDate != null || dates.endDate != null) {
      ctx.addIssue({
        code: "custom",
        message: "날짜 미정 모드에서는 출발·귀국일을 비워 주세요.",
        path: ["startDate"],
      });
    }
  });

export const plannerDraftInputSchema = z
  .object({
    destination: z.object({
      text: plannerDestinationTextSchema,
    }),
    dates: plannerDraftDatesSchema,
    travelers: z.object({
      adults: z
        .number()
        .int("성인 인원은 정수여야 합니다.")
        .min(1, "성인은 1명 이상이어야 합니다.")
        .max(20, "성인은 20명 이하로 입력해 주세요."),
      children: z
        .number()
        .int("아이 인원은 정수여야 합니다.")
        .min(0, "아이 인원은 0 이상이어야 합니다.")
        .max(20, "아이는 20명 이하로 입력해 주세요."),
    }),
    companionType: plannerCompanionTypeSchema,
    interests: z
      .array(plannerInterestSchema)
      .min(1, "여행 취향을 1개 이상 선택해 주세요.")
      .max(PLANNER_INTERESTS.length)
      .transform((items) => Array.from(new Set(items))),
    themeRequest: z
      .string()
      .trim()
      .max(1000, "여행 분위기 요청은 1000자 이내로 입력해 주세요."),
    pace: plannerPaceSchema,
    budget: z.object({
      style: plannerBudgetStyleSchema.nullable(),
      amount: z
        .number()
        .finite()
        .nonnegative("예산은 0 이상이어야 합니다.")
        .nullable(),
      scope: plannerBudgetScopeSchema,
      currency: z.literal("KRW"),
    }),
    additionalRequest: z
      .string()
      .trim()
      .max(1000, "요청사항은 1000자 이내로 입력해 주세요."),
  })
  .strict();

export type PlannerDraftInputParsed = z.infer<typeof plannerDraftInputSchema>;

/** Intermediate draft — structure-valid fields; empties allowed until finalize. */
export const plannerDraftInputProgressSchema = z
  .object({
    destination: z.object({
      text: z.string().trim().max(120),
    }),
    dates: z.object({
      mode: plannerDateModeSchema,
      startDate: z.union([isoDateSchema, z.literal(""), z.null()]),
      endDate: z.union([isoDateSchema, z.literal(""), z.null()]),
      durationDays: z.number().int().min(1).max(PLANNER_DURATION_DAYS_MAX),
    }),
    travelers: z.object({
      adults: z.number().int().min(1).max(20),
      children: z.number().int().min(0).max(20),
    }),
    companionType: plannerCompanionTypeSchema,
    interests: z.array(plannerInterestSchema).max(PLANNER_INTERESTS.length),
    themeRequest: z.string().trim().max(1000),
    pace: plannerPaceSchema,
    budget: z.object({
      style: plannerBudgetStyleSchema.nullable(),
      amount: z.number().finite().nonnegative().nullable(),
      scope: plannerBudgetScopeSchema,
      currency: z.literal("KRW"),
    }),
    additionalRequest: z.string().trim().max(1000),
  })
  .strict()
  .transform((input) => ({
    ...input,
    dates: {
      ...input.dates,
      startDate: input.dates.startDate === "" ? null : input.dates.startDate,
      endDate: input.dates.endDate === "" ? null : input.dates.endDate,
    },
  }));

export const createPlannerSessionBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
    destination: plannerDestinationTextSchema,
    sourceProductId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type CreatePlannerSessionBody = z.infer<typeof createPlannerSessionBodySchema>;

export const updatePlannerSessionBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
    input: plannerDraftInputProgressSchema,
    finalize: z.boolean().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (!body.finalize) return;
    const full = plannerDraftInputSchema.safeParse(body.input);
    if (!full.success) {
      for (const issue of full.error.issues) {
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: ["input", ...issue.path],
        });
      }
    }
  });

export type UpdatePlannerSessionBody = z.infer<typeof updatePlannerSessionBodySchema>;

export function validatePlannerStep(
  step: number,
  input: z.infer<typeof plannerDraftInputProgressSchema>,
): string | null {
  if (step === 1) {
    const r = plannerDestinationTextSchema.safeParse(input.destination.text);
    return r.success ? null : (r.error.issues[0]?.message ?? "목적지를 확인해 주세요.");
  }
  if (step === 2) {
    if (input.dates.mode === "flexible") {
      if (
        input.dates.durationDays < PLANNER_DURATION_DAYS_MIN ||
        input.dates.durationDays > PLANNER_DURATION_DAYS_MAX
      ) {
        return `여행 일수는 ${PLANNER_DURATION_DAYS_MIN}~${PLANNER_DURATION_DAYS_MAX}일로 선택해 주세요.`;
      }
      return null;
    }
    if (!isIsoDateYmd(input.dates.startDate)) {
      return "출발일을 선택해 주세요.";
    }
    if (!isIsoDateYmd(input.dates.endDate)) {
      return "귀국일을 선택해 주세요.";
    }
    if (input.dates.endDate < input.dates.startDate) {
      return "귀국일은 출발일 이후여야 합니다.";
    }
    const days = computeDurationDays(input.dates.startDate, input.dates.endDate);
    if (days == null || days < PLANNER_DURATION_DAYS_MIN || days > PLANNER_DURATION_DAYS_MAX) {
      return `여행 기간은 ${PLANNER_DURATION_DAYS_MIN}~${PLANNER_DURATION_DAYS_MAX}일로 선택해 주세요.`;
    }
    return null;
  }
  if (step === 3) {
    if (input.travelers.adults < 1) return "성인은 1명 이상이어야 합니다.";
    if (input.travelers.children < 0) return "아이 인원이 올바르지 않습니다.";
    const c = plannerCompanionTypeSchema.safeParse(input.companionType);
    return c.success ? null : "동행 유형을 선택해 주세요.";
  }
  if (step === 4) {
    if (input.interests.length < 1) return "여행 취향을 1개 이상 선택해 주세요.";
    if (input.themeRequest.length > 1000) {
      return "여행 분위기 요청은 1000자 이내로 입력해 주세요.";
    }
    return null;
  }
  if (step === 5) {
    const p = plannerPaceSchema.safeParse(input.pace);
    if (!p.success) return "여행 속도를 선택해 주세요.";
    if (input.budget.amount != null && input.budget.amount < 0) {
      return "예산은 0 이상이어야 합니다.";
    }
    return null;
  }
  if (step === 6) {
    if (input.additionalRequest.length > 1000) {
      return "요청사항은 1000자 이내로 입력해 주세요.";
    }
    return null;
  }
  if (step === 7) {
    const full = plannerDraftInputSchema.safeParse(input);
    return full.success ? null : (full.error.issues[0]?.message ?? "입력을 확인해 주세요.");
  }
  return null;
}
