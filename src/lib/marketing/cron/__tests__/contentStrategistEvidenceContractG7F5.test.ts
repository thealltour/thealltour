vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  CONTENT_STRATEGIST_MAX_MODEL_INVOCATIONS,
  buildContentDraftPrompt,
  buildContentDraftFormatRepairPrompt,
  buildContentDraftGroundingRepairPrompt,
  classifyContentStrategistRuntimeFailure,
  collectSuppliedEvidenceRefs,
  parseContentStrategistOutput,
  parseContentStrategistOutputDetailed,
  requestContentStrategistDraftWithFormatRetry,
  ContentStrategistFormatError,
  ContentStrategistRuntimeError,
  isContentStrategistRuntimeError,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import type { ContentDraftRequest } from "@/lib/marketing/bot/organization/handoffs";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";
const EVIDENCE_IDS = [
  "eeda7bc0-0683-4e1d-9fe2-1af2798fc1fa",
  "7227aaa3-d04e-4d15-b861-d7e47d484616",
  "41f8d7e4-fc68-4b5c-b762-a8a558d68ab2",
] as const;

function taiwanEvidenceRefs() {
  return EVIDENCE_IDS.map((evidenceId, index) => ({
    evidenceId,
    sourceId: "a3011111-1111-4111-8111-111111111101",
    sourceType: "official_government",
    sourceName: "UK FCDO",
    isOfficial: true,
    evidenceType: "official_statement",
    url: `https://example.com/taiwan-${index}`,
    reference: null,
    excerpt: "Health guidance for Taiwan travellers.",
    publishedAt: "2026-09-01T00:00:00.000Z",
    observedAt: NOW.toISOString(),
    credibilityHint: 0.9,
  }));
}

function draftPayload(): ContentDraftRequest {
  const evidenceRefs = taiwanEvidenceRefs();
  const handoff = prepareManagerToContentHandoff(
    {
      title: "taiwan",
      summary: "UK FCDO updated Taiwan health travel guidance.",
      agendaCandidateId: "43ef5a0f-87f3-4462-8536-66861c1b9052",
      researchBriefId: "e4be07c6-1eba-46d0-b1dc-5a5e05e6e595",
      evidenceRefs,
      channel: "threads",
      idempotencyKey: "g7f5-taiwan-cs",
      now: NOW,
    },
    { store: createInMemoryContentAssignmentStore(), now: NOW },
  );
  return {
    productId: PRODUCT,
    channel: "threads",
    goal: "test",
    agenda: handoff.selectedAgenda.title,
    brief: null,
    constraints: ["do not invent product facts", "do not publish"],
    memoryReferences: [],
    contentAssignmentId: handoff.contentAssignment.assignmentId,
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlanScaffold: handoff.contentPlanScaffold,
  };
}

function validDraftWithRefs(evidenceId: string = EVIDENCE_IDS[0]) {
  const ref = taiwanEvidenceRefs().find((r) => r.evidenceId === evidenceId)!;
  return {
    title: "Taiwan health guidance update",
    body: "UK FCDO updated Taiwan travel health guidance for travellers.",
    channel: "threads",
    agenda: "taiwan",
    sourceReferences: [`evidence:${evidenceId}`],
    assignmentId: "ca_taiwan",
    contentPlan: {
      assignmentId: "ca_taiwan",
      factsToUse: ["UK FCDO updated Taiwan travel health guidance for travellers."],
      evidenceRefs: [ref],
    },
  };
}

function absentEvidenceDraft() {
  return {
    title: "Taiwan health guidance update",
    body: "UK FCDO updated Taiwan travel health guidance for travellers.",
    channel: "threads",
    agenda: "taiwan",
    sourceReferences: [],
    assignmentId: "ca_taiwan",
    contentPlan: {
      assignmentId: "ca_taiwan",
      factsToUse: ["UK FCDO updated Taiwan travel health guidance for travellers."],
      // evidenceRefs intentionally absent
    },
  };
}

function emptyEvidenceDraft() {
  return {
    ...absentEvidenceDraft(),
    contentPlan: {
      assignmentId: "ca_taiwan",
      factsToUse: ["UK FCDO updated Taiwan travel health guidance for travellers."],
      evidenceRefs: [],
    },
  };
}

describe("G7-F5 Content Strategist evidence-contract reliability", () => {
  it("1: prompt exposes supplied evidence refs clearly", () => {
    const payload = draftPayload();
    const prompt = buildContentDraftPrompt(payload);
    expect(prompt).toContain("AVAILABLE_EVIDENCE_REFS:");
    for (const id of EVIDENCE_IDS) {
      expect(prompt).toContain(`- ${id}`);
    }
    expect(collectSuppliedEvidenceRefs(payload)).toHaveLength(3);
  });

  it("2: prompt contract explicitly requires evidenceRefs", () => {
    const prompt = buildContentDraftPrompt(draftPayload());
    expect(prompt).toMatch(/evidenceRefs is REQUIRED/i);
    expect(prompt).toContain('"evidenceRefs":["<supplied-evidence-id>"]');
    expect(prompt).toContain("Use ONLY IDs listed in AVAILABLE_EVIDENCE_REFS");
  });

  it("3: valid plan with supplied evidence ID passes", () => {
    const payload = draftPayload();
    const output = parseContentStrategistOutput(JSON.stringify(validDraftWithRefs()), {
      suppliedEvidenceRefs: collectSuppliedEvidenceRefs(payload),
    });
    expect(output.contentPlan?.evidenceRefs?.length).toBe(1);
    expect(output.contentPlan?.evidenceRefs?.[0]?.evidenceId).toBe(EVIDENCE_IDS[0]);
  });

  it("4: absent evidenceRefs + factual claims triggers ONE grounding repair", async () => {
    const invoke = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify(absentEvidenceDraft()))
      .mockReturnValueOnce(JSON.stringify(validDraftWithRefs()));
    const { output, diagnostics } = await requestContentStrategistDraftWithFormatRetry({
      payload: draftPayload(),
      invoke,
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(diagnostics.groundingRetryUsed).toBe(true);
    expect(diagnostics.formatRetryUsed).toBe(false);
    expect(diagnostics.firstAttemptFailureClass).toBe("evidence_refs_absent");
    expect(diagnostics.groundingFailureClass).toBe("evidence_refs_absent");
    expect(diagnostics.finalParseMode).toBe("grounding_retry");
    expect(output.contentPlan?.evidenceRefs?.length).toBeGreaterThanOrEqual(1);
    expect(String(invoke.mock.calls[1]?.[0])).toContain("grounding contract");
  });

  it("5: empty evidenceRefs triggers ONE grounding repair", async () => {
    const invoke = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify(emptyEvidenceDraft()))
      .mockReturnValueOnce(JSON.stringify(validDraftWithRefs(EVIDENCE_IDS[1])));
    const { diagnostics } = await requestContentStrategistDraftWithFormatRetry({
      payload: draftPayload(),
      invoke,
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(diagnostics.groundingRetryUsed).toBe(true);
    expect(diagnostics.groundingFailureClass).toBe("evidence_refs_empty");
    expect(diagnostics.evidenceRefsCount).toBe(1);
  });

  it("6: grounding repair returning valid supplied ID passes", async () => {
    const repaired = validDraftWithRefs(EVIDENCE_IDS[2]);
    // Model returns string IDs — must resolve against supplied set.
    repaired.contentPlan.evidenceRefs = [EVIDENCE_IDS[2]] as unknown as typeof repaired.contentPlan.evidenceRefs;
    const invoke = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify(absentEvidenceDraft()))
      .mockReturnValueOnce(JSON.stringify(repaired));
    const { output, diagnostics } = await requestContentStrategistDraftWithFormatRetry({
      payload: draftPayload(),
      invoke,
    });
    expect(diagnostics.groundingRetryUsed).toBe(true);
    expect(output.contentPlan?.evidenceRefs?.[0]?.evidenceId).toBe(EVIDENCE_IDS[2]);
    expect(diagnostics.suppliedEvidenceRefCount).toBe(3);
  });

  it("7: grounding repair returning fabricated ID fails", async () => {
    const fabricated = validDraftWithRefs();
    fabricated.contentPlan.evidenceRefs = [
      {
        ...taiwanEvidenceRefs()[0],
        evidenceId: "fabricated-evidence-id-00000000",
      },
    ];
    const invoke = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify(absentEvidenceDraft()))
      .mockReturnValueOnce(JSON.stringify(fabricated));
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toThrow(/Fabricated or unknown evidence ID|invalid_evidence_shape/);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("8: second absent/empty result fails (no further retry)", async () => {
    const invoke = vi.fn().mockReturnValue(JSON.stringify(absentEvidenceDraft()));
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toThrow(/evidence_refs_absent|evidenceRefs field is absent/);
    expect(invoke).toHaveBeenCalledTimes(CONTENT_STRATEGIST_MAX_MODEL_INVOCATIONS);
  });

  it("9: no canonical evidence => no repair and fail closed", async () => {
    const payload = draftPayload();
    // Strip all evidence pools
    payload.contentAssignment = {
      ...payload.contentAssignment!,
      evidenceRefs: [],
      facts: payload.contentAssignment!.facts.map((f) => ({ ...f, evidenceRefs: [] })),
    };
    payload.contentPlanScaffold = {
      ...payload.contentPlanScaffold!,
      evidenceRefs: [],
    };
    payload.selectedAgenda = {
      ...payload.selectedAgenda!,
      evidenceRefs: [],
    };
    expect(collectSuppliedEvidenceRefs(payload)).toHaveLength(0);
    const invoke = vi.fn().mockReturnValue(JSON.stringify(absentEvidenceDraft()));
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload, invoke }),
    ).rejects.toThrow(/evidence_refs_absent|evidenceRefs field is absent/);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("10: evidence_refs_absent is NOT treated as format failure", async () => {
    const invoke = vi.fn().mockReturnValue(JSON.stringify(absentEvidenceDraft()));
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.not.toBeInstanceOf(ContentStrategistFormatError);
    const detailed = parseContentStrategistOutputDetailed(JSON.stringify(absentEvidenceDraft()), {
      suppliedEvidenceRefs: collectSuppliedEvidenceRefs(draftPayload()),
    });
    expect(detailed.ok).toBe(false);
    if (!detailed.ok) expect(detailed.kind).toBe("semantic");
  });

  it("11: malformed JSON still uses G7-F2 format retry", async () => {
    const invoke = vi
      .fn()
      .mockReturnValueOnce("{not-json")
      .mockReturnValueOnce(JSON.stringify(validDraftWithRefs()));
    const { diagnostics } = await requestContentStrategistDraftWithFormatRetry({
      payload: draftPayload(),
      invoke,
    });
    expect(diagnostics.formatRetryUsed).toBe(true);
    expect(diagnostics.groundingRetryUsed).toBe(false);
    expect(diagnostics.finalParseMode).toBe("format_retry");
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(buildContentDraftFormatRepairPrompt(draftPayload(), "malformed_json")).toContain(
      "INVALID JSON/format",
    );
  });

  it("12: timeout/runtime throw does not use format retry", async () => {
    const invoke = vi.fn().mockImplementation(() => {
      throw new Error("content-strategist timed out after 180000ms");
    });
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toThrow(/timed out/);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("13: known Hermes HTTP/API error stdout is classified runtime failure", () => {
    const raw =
      "API call failed after 3 retries: HTTP 503: AI_RUNTIME_INFERENCE_GATEWAY_TOKEN is not configured\n";
    expect(classifyContentStrategistRuntimeFailure(raw)).toBe("gateway_misconfigured");
    const detailed = parseContentStrategistOutputDetailed(raw);
    expect(detailed.ok).toBe(false);
    if (!detailed.ok) {
      expect(detailed.kind).toBe("runtime");
      expect(detailed.failureClass).toBe("gateway_misconfigured");
    }
  });

  it("14: runtime error does not grounding-retry", async () => {
    const raw =
      "API call failed after 3 retries: HTTP 503: AI_RUNTIME_INFERENCE_GATEWAY_TOKEN is not configured\n";
    const invoke = vi.fn().mockReturnValue(raw);
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toBeInstanceOf(ContentStrategistRuntimeError);
    expect(invoke).toHaveBeenCalledTimes(1);
    try {
      await requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke });
    } catch (error) {
      expect(isContentStrategistRuntimeError(error)).toBe(true);
      if (isContentStrategistRuntimeError(error)) {
        expect(error.diagnostics.groundingRetryUsed).toBe(false);
        expect(error.diagnostics.formatRetryUsed).toBe(false);
        expect(error.toPipelineMessage()).toContain("content_strategist_runtime_failed");
      }
    }
  });

  it("15: format then semantic does not chain grounding (max 2)", async () => {
    const invoke = vi
      .fn()
      .mockReturnValueOnce("not json at all {{{")
      .mockReturnValueOnce(JSON.stringify(absentEvidenceDraft()));
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toThrow(/evidence_refs_absent/);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls.some((c) => String(c[0]).includes("grounding contract"))).toBe(false);
  });

  it("16: Taiwan fixture evidence ×3 reaches prompt", () => {
    const payload = draftPayload();
    const prompt = buildContentDraftPrompt(payload);
    expect(collectSuppliedEvidenceRefs(payload).map((r) => r.evidenceId)).toEqual([...EVIDENCE_IDS]);
    for (const id of EVIDENCE_IDS) {
      expect(prompt).toContain(id);
    }
    expect(buildContentDraftGroundingRepairPrompt(payload, "evidence_refs_absent")).toContain(
      EVIDENCE_IDS[0],
    );
  });

  it("17: max model invocations is 2", () => {
    expect(CONTENT_STRATEGIST_MAX_MODEL_INVOCATIONS).toBe(2);
  });
});
