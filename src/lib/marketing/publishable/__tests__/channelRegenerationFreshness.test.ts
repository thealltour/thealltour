/**
 * Scoped regenerate freshness helpers.
 */
import { describe, expect, it } from "vitest";

import {
  buildChannelRegenerationDiagnostics,
  evaluateScopedRegenerationFreshness,
  formatForceRegenerateAvoidBlock,
  markStaleScopedRegeneration,
  publishableBodiesEqual,
} from "@/lib/marketing/publishable/channelRegenerationFreshness";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";

function slot(overrides: Partial<PublishableChannelContent> & { body: string }): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "threads",
    format: "threads_text",
    title: null,
    status: "generated",
    generatedAt: "2026-09-27T00:00:00.000Z",
    sourceCandidateId: "cmc_x",
    sourceRevision: "rev",
    provenance: {
      composer: "llm",
      evidenceRefIds: [],
      commercialIntent: "informational",
      generationMode: "llm",
      attemptCount: 1,
      latencyMs: 1200,
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    needsRegeneration: false,
    ...overrides,
  };
}

describe("channelRegenerationFreshness", () => {
  it("rejects specialist-style zero-attempt reuse", () => {
    const prior = slot({ body: "same body" });
    const next = slot({
      body: "same body",
      provenance: {
        ...prior.provenance,
        attemptCount: 0,
        latencyMs: 1,
      },
    });
    const verdict = evaluateScopedRegenerationFreshness({ prior, next });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("package_reuse_or_zero_attempts");
  });

  it("rejects identical body even after LLM attempts", () => {
    const prior = slot({ body: "동일 본문입니다." });
    const next = slot({ body: "동일 본문입니다." });
    const verdict = evaluateScopedRegenerationFreshness({ prior, next });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("body_unchanged");
  });

  it("accepts changed body with attemptCount>=1", () => {
    const prior = slot({ body: "이전 본문" });
    const next = slot({ body: "새로운 본문" });
    const verdict = evaluateScopedRegenerationFreshness({ prior, next });
    expect(verdict).toEqual({ ok: true, bodyChanged: true });
  });

  it("normalizes whitespace for body compare", () => {
    expect(publishableBodiesEqual("a  b\n\nc", "a b\nc")).toBe(true);
  });

  it("markStaleScopedRegeneration clears publishableSuccess", () => {
    const marked = markStaleScopedRegeneration({
      content: slot({ body: "x" }),
      failureMessage: "scoped_regenerate_rejected_identical_body",
    });
    expect(marked.publishableSuccess).toBe(false);
    expect(marked.provenance.failureMessage).toContain("identical_body");
  });

  it("formatForceRegenerateAvoidBlock includes prior when present", () => {
    const block = formatForceRegenerateAvoidBlock({
      priorBody: "이전 초안",
      regenerationNonce: "threads:1",
    });
    expect(block).toContain("FORCE_REGENERATE");
    expect(block).toContain("PRIOR_BODY_TO_AVOID");
    expect(block).toContain("이전 초안");
  });

  it("buildChannelRegenerationDiagnostics reports bodyChanged", () => {
    const diag = buildChannelRegenerationDiagnostics({
      slot: slot({ body: "new" }),
      priorBody: "old",
    });
    expect(diag.status).toBe("generated");
    expect(diag.bodyChanged).toBe(true);
    expect(diag.attemptCount).toBe(1);
  });
});
