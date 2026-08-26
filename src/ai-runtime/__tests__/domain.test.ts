import { describe, expect, it } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { ProviderDefinition } from "@/ai-runtime/domain/provider";
import type { ModelLimits } from "@/ai-runtime/domain/model";
import type { QuotaReservationResult } from "@/ai-runtime/domain/quota";
import type { WorkloadRoutingPolicy } from "@/ai-runtime/domain/routing";
import { RuntimeError } from "@/ai-runtime/domain/error";
import { FORBIDDEN_PROVIDER_SECRET_KEYS, PRIORITY_WEIGHT } from "@/ai-runtime/domain";
import {
  modelCapabilitiesSchema,
  modelLimitsSchema,
  parseOrThrow,
  providerDefinitionHasRawSecrets,
  providerDefinitionSchema,
  quotaReservationResultSchema,
  runtimeRequestSchema,
} from "@/ai-runtime/domain/schemas";

describe("ai-runtime domain", () => {
  it("allows RuntimeRequest without providerId/modelId binding", () => {
    const request: RuntimeRequest = {
      id: "req-1",
      createdAt: new Date().toISOString(),
      agentId: "marketing-manager",
      source: "desktop",
      workload: "manager_decision",
      priority: "high",
      messages: [{ role: "user", content: "test" }],
      metadata: { correlationId: "org-req-42" },
    };

    const parsed = parseOrThrow(runtimeRequestSchema, request, "RuntimeRequest");
    expect(parsed.id).toBe("req-1");
    expect(parsed.metadata?.correlationId).toBe("org-req-42");
    expect("providerId" in parsed).toBe(false);
    expect("modelId" in parsed).toBe(false);
    expect(PRIORITY_WEIGHT.high).toBe(80);
  });

  it("rejects empty request id and invalid workload enum", () => {
    expect(() =>
      parseOrThrow(
        runtimeRequestSchema,
        {
          id: "  ",
          createdAt: new Date().toISOString(),
          agentId: "marketing-manager",
          source: "desktop",
          workload: "manager_decision",
          priority: "high",
          messages: [{ role: "user", content: "x" }],
        },
        "RuntimeRequest",
      ),
    ).toThrow(RuntimeError);

    expect(() =>
      parseOrThrow(
        runtimeRequestSchema,
        {
          id: "req-2",
          createdAt: new Date().toISOString(),
          agentId: "marketing-manager",
          source: "desktop",
          workload: "not-a-workload",
          priority: "high",
          messages: [{ role: "user", content: "x" }],
        },
        "RuntimeRequest",
      ),
    ).toThrow(/validation failed/i);
  });

  it("supports QuotaReservationResult discriminated union", () => {
    const accepted: QuotaReservationResult = {
      accepted: true,
      reservationId: "rsv-1",
      expiresAt: new Date().toISOString(),
    };
    const rejected: QuotaReservationResult = {
      accepted: false,
      reason: "rpm",
      retryAfterMs: 1500,
    };

    expect(parseOrThrow(quotaReservationResultSchema, accepted, "quota").accepted).toBe(true);
    const parsedRejected = parseOrThrow(quotaReservationResultSchema, rejected, "quota");
    expect(parsedRejected.accepted).toBe(false);
    if (!parsedRejected.accepted) {
      expect(parsedRejected.reason).toBe("rpm");
      expect(parsedRejected.retryAfterMs).toBe(1500);
    }
  });

  it("preserves RuntimeError code, retryable, and retryAfterMs", () => {
    const error = new RuntimeError("RATE_LIMIT", "slow down", true, 2000, { upstream: 429 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RuntimeError");
    expect(error.code).toBe("RATE_LIMIT");
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(2000);
    expect(error.cause).toEqual({ upstream: 429 });
  });

  it("allows undefined model limits as unknown/not configured", () => {
    const limits: ModelLimits = {};
    const parsed = parseOrThrow(modelLimitsSchema, limits, "ModelLimits");
    expect(parsed.rpm).toBeUndefined();
    expect(parsed.tpm).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, "rpm")).toBe(false);
  });

  it("validates capability scores in 0–5 and rejects negatives", () => {
    expect(
      modelCapabilitiesSchema.safeParse({
        reasoning: 4,
        writing: 5,
        extraction: 0,
        summarization: 3,
        structuredOutput: true,
        toolCalling: false,
      }).success,
    ).toBe(true);

    expect(
      modelCapabilitiesSchema.safeParse({
        reasoning: 6,
        writing: 1,
        extraction: 1,
        summarization: 1,
        structuredOutput: false,
        toolCalling: false,
      }).success,
    ).toBe(false);

    expect(
      modelLimitsSchema.safeParse({ rpm: -1 }).success,
    ).toBe(false);
  });

  it("keeps ProviderDefinition free of raw secret fields", () => {
    const provider: ProviderDefinition = {
      id: "prov-gemini-1",
      kind: "gemini",
      displayName: "Gemini project",
      enabled: true,
      credentialRef: "cred-store-handle-abc",
      quotaScope: "project",
      metadata: { region: "us" },
    };

    expect(parseOrThrow(providerDefinitionSchema, provider, "ProviderDefinition").credentialRef).toBe(
      "cred-store-handle-abc",
    );
    expect(providerDefinitionHasRawSecrets(provider)).toBe(false);
    expect(FORBIDDEN_PROVIDER_SECRET_KEYS).toContain("apiKey");

    expect(
      providerDefinitionHasRawSecrets({
        ...provider,
        apiKey: "sk-live-should-never-exist",
      }),
    ).toBe(true);

    expect(
      providerDefinitionSchema.safeParse({
        ...provider,
        metadata: { apiKey: "nope" },
      }).success,
    ).toBe(false);
  });

  it("expresses manager_decision routing policy without provider binding", () => {
    const policy: WorkloadRoutingPolicy = {
      workload: "manager_decision",
      fallbackOrder: ["equivalent", "queue", "fail"],
      minimumCapabilityScore: 4,
    };
    expect(policy.workload).toBe("manager_decision");
    expect(policy.fallbackOrder[0]).toBe("equivalent");
  });
});
