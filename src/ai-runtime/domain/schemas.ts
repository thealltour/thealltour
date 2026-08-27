import { z } from "zod";

import { RUNTIME_REQUEST_SOURCES } from "@/ai-runtime/domain/agent";
import { WORKLOAD_CLASSES } from "@/ai-runtime/domain/workload";
import { RUNTIME_PRIORITIES } from "@/ai-runtime/domain/priority";
import {
  FORBIDDEN_PROVIDER_SECRET_KEYS,
  PROVIDER_KINDS,
  QUOTA_SCOPES,
} from "@/ai-runtime/domain/provider";
import { RUNTIME_MESSAGE_ROLES } from "@/ai-runtime/domain/request";
import {
  RUNTIME_FINISH_REASONS,
  RUNTIME_ROUTE_ATTEMPT_RESULTS,
} from "@/ai-runtime/domain/response";
import { QUOTA_HEALTH_STATES, QUOTA_REJECTION_REASONS } from "@/ai-runtime/domain/quota";
import { FALLBACK_POLICIES } from "@/ai-runtime/domain/routing";
import { RUNTIME_JOB_STATUSES } from "@/ai-runtime/domain/job";
import { RuntimeError } from "@/ai-runtime/domain/error";

const nonEmptyId = z.string().trim().min(1, "id must be non-empty");
const nonNegativeInt = z.number().int().min(0);
const nonNegativeNumber = z.number().min(0);
const capabilityScore = z.number().min(0).max(5);
/** ISO-8601-ish timestamps — same light check style as marketing context (non-empty string). */
const isoTimestamp = z.string().trim().min(1);

function assertNoForbiddenSecretKeys(
  value: Record<string, string> | undefined,
  path: string,
): void {
  if (!value) return;
  for (const key of Object.keys(value)) {
    if ((FORBIDDEN_PROVIDER_SECRET_KEYS as readonly string[]).includes(key)) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        `${path} must not contain secret key "${key}"`,
        false,
      );
    }
  }
}

export const modelCapabilitiesSchema = z.object({
  reasoning: capabilityScore,
  writing: capabilityScore,
  extraction: capabilityScore,
  summarization: capabilityScore,
  structuredOutput: z.boolean(),
  toolCalling: z.boolean(),
  vision: z.boolean().optional(),
});

export const modelLimitsSchema = z.object({
  contextTokens: nonNegativeInt.optional(),
  maxOutputTokens: nonNegativeInt.optional(),
  rpm: nonNegativeInt.optional(),
  tpm: nonNegativeInt.optional(),
  rpd: nonNegativeInt.optional(),
  tpd: nonNegativeInt.optional(),
  inputTpm: nonNegativeInt.optional(),
  outputTpm: nonNegativeInt.optional(),
});

export const modelEconomicsSchema = z.object({
  inputCostPerMillionTokens: nonNegativeNumber.optional(),
  outputCostPerMillionTokens: nonNegativeNumber.optional(),
  freeTierEligible: z.boolean().optional(),
});

export const modelRoutingConfigSchema = z.object({
  workloadClasses: z.array(z.enum(WORKLOAD_CLASSES)).min(1),
  basePriority: nonNegativeNumber,
  enabled: z.boolean(),
});

export const providerDefinitionSchema = z
  .object({
    id: nonEmptyId,
    kind: z.enum(PROVIDER_KINDS),
    displayName: z.string().trim().min(1),
    enabled: z.boolean(),
    credentialRef: z.string().trim().min(1).optional(),
    quotaScope: z.enum(QUOTA_SCOPES),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((value, ctx) => {
    try {
      assertNoForbiddenSecretKeys(value.metadata, "ProviderDefinition.metadata");
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "forbidden secret key",
        path: ["metadata"],
      });
    }
  });

export const modelDefinitionSchema = z.object({
  id: nonEmptyId,
  providerId: nonEmptyId,
  modelId: nonEmptyId,
  displayName: z.string().trim().min(1),
  capabilities: modelCapabilitiesSchema,
  limits: modelLimitsSchema,
  economics: modelEconomicsSchema,
  routing: modelRoutingConfigSchema,
  metadata: z.record(z.string(), z.string()).optional(),
});

export const tokenUsageSchema = z
  .object({
    inputTokens: nonNegativeInt,
    outputTokens: nonNegativeInt,
    totalTokens: nonNegativeInt,
    cachedInputTokens: nonNegativeInt.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.totalTokens < value.inputTokens + value.outputTokens) {
      ctx.addIssue({
        code: "custom",
        message: "totalTokens must be >= inputTokens + outputTokens",
        path: ["totalTokens"],
      });
    }
  });

export const costUsageSchema = z.object({
  inputCost: nonNegativeNumber.optional(),
  outputCost: nonNegativeNumber.optional(),
  totalCost: nonNegativeNumber.optional(),
  currency: z.literal("USD").optional(),
});

export const runtimeMessageSchema = z.object({
  role: z.enum(RUNTIME_MESSAGE_ROLES),
  content: z.string(),
});

export const runtimeRoutingHintsSchema = z.object({
  preferredProviderIds: z.array(nonEmptyId).optional(),
  preferredModelIds: z.array(nonEmptyId).optional(),
  excludedProviderIds: z.array(nonEmptyId).optional(),
  excludedModelIds: z.array(nonEmptyId).optional(),
  requiresStructuredOutput: z.boolean().optional(),
  requiresToolCalling: z.boolean().optional(),
  allowFallback: z.boolean().optional(),
  allowQueue: z.boolean().optional(),
});

export const runtimeRequestMetadataSchema = z.object({
  conversationId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  parentRequestId: z.string().min(1).optional(),
  handoffId: z.string().min(1).optional(),
  cronJobId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
});

export const runtimeRequestSchema = z
  .object({
    id: nonEmptyId,
    createdAt: isoTimestamp,
    agentId: z.string().trim().min(1),
    source: z.enum(RUNTIME_REQUEST_SOURCES),
    workload: z.enum(WORKLOAD_CLASSES),
    priority: z.enum(RUNTIME_PRIORITIES),
    messages: z.array(runtimeMessageSchema).min(1),
    expectedOutputTokens: nonNegativeInt.optional(),
    deadlineAt: isoTimestamp.optional(),
    routing: runtimeRoutingHintsSchema.optional(),
    metadata: runtimeRequestMetadataSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const record = value as Record<string, unknown>;
    if ("providerId" in record && record.providerId != null) {
      ctx.addIssue({
        code: "custom",
        message: "RuntimeRequest must not bind providerId; use routing hints only",
        path: ["providerId"],
      });
    }
    if ("modelId" in record && record.modelId != null) {
      ctx.addIssue({
        code: "custom",
        message: "RuntimeRequest must not bind modelId; use routing hints only",
        path: ["modelId"],
      });
    }
  });

export const runtimeRouteAttemptSchema = z.object({
  providerId: nonEmptyId,
  modelId: nonEmptyId,
  startedAt: isoTimestamp,
  result: z.enum(RUNTIME_ROUTE_ATTEMPT_RESULTS),
  detail: z.string().trim().min(1).optional(),
});

export const runtimeRoutingResultSchema = z.object({
  attempts: z.array(runtimeRouteAttemptSchema),
  fallbackUsed: z.boolean(),
  queueWaitMs: nonNegativeInt.optional(),
});

export const runtimeResponseSchema = z.object({
  requestId: nonEmptyId,
  providerId: nonEmptyId,
  modelId: nonEmptyId,
  content: z.string(),
  usage: tokenUsageSchema,
  cost: costUsageSchema.optional(),
  latencyMs: nonNegativeNumber,
  finishReason: z.enum(RUNTIME_FINISH_REASONS).optional(),
  routing: runtimeRoutingResultSchema,
  rawMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const quotaCapacitySchema = z.object({
  rpm: nonNegativeInt.optional(),
  tpm: nonNegativeInt.optional(),
  rpd: nonNegativeInt.optional(),
  tpd: nonNegativeInt.optional(),
  inputTpm: nonNegativeInt.optional(),
  outputTpm: nonNegativeInt.optional(),
});

export const quotaUsageSnapshotSchema = z.object({
  providerId: nonEmptyId,
  modelId: nonEmptyId.optional(),
  windowStartedAt: isoTimestamp,
  requestCount: nonNegativeInt,
  inputTokens: nonNegativeInt,
  outputTokens: nonNegativeInt,
  totalTokens: nonNegativeInt,
});

export const quotaHealthSchema = z.enum(QUOTA_HEALTH_STATES);

export const quotaReservationRequestSchema = z.object({
  requestId: nonEmptyId,
  providerId: nonEmptyId,
  modelId: nonEmptyId,
  estimatedInputTokens: nonNegativeInt,
  estimatedOutputTokens: nonNegativeInt,
});

export const quotaReservationResultSchema = z.discriminatedUnion("accepted", [
  z.object({
    accepted: z.literal(true),
    reservationId: nonEmptyId,
    expiresAt: isoTimestamp,
  }),
  z.object({
    accepted: z.literal(false),
    reason: z.enum(QUOTA_REJECTION_REASONS),
    retryAfterMs: nonNegativeInt.optional(),
  }),
]);

export const workloadRoutingPolicySchema = z.object({
  workload: z.enum(WORKLOAD_CLASSES),
  fallbackOrder: z.array(z.enum(FALLBACK_POLICIES)).min(1),
  minimumCapabilityScore: capabilityScore.optional(),
  maxEstimatedCostUsd: nonNegativeNumber.optional(),
  maxQueueWaitMs: nonNegativeInt.optional(),
});

export const runtimeJobSchema = z.object({
  id: nonEmptyId,
  request: runtimeRequestSchema,
  status: z.enum(RUNTIME_JOB_STATUSES),
  queuedAt: isoTimestamp,
  startedAt: isoTimestamp.optional(),
  completedAt: isoTimestamp.optional(),
  attempts: nonNegativeInt,
  availableAt: isoTimestamp.optional(),
  lastError: z.string().optional(),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new RuntimeError(
      "INVALID_REQUEST",
      `${label} validation failed: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      false,
      undefined,
      parsed.error,
    );
  }
  return parsed.data;
}

export function providerDefinitionHasRawSecrets(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  for (const key of FORBIDDEN_PROVIDER_SECRET_KEYS) {
    if (key in record) return true;
  }
  const metadata = record.metadata;
  if (metadata && typeof metadata === "object") {
    for (const key of Object.keys(metadata as Record<string, unknown>)) {
      if ((FORBIDDEN_PROVIDER_SECRET_KEYS as readonly string[]).includes(key)) return true;
    }
  }
  return false;
}
