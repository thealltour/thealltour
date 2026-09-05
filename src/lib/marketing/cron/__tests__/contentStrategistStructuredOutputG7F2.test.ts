vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  buildContentDraftFormatRepairPrompt,
  parseContentStrategistOutput,
  parseContentStrategistOutputDetailed,
  requestContentStrategistDraftWithFormatRetry,
  ContentStrategistFormatError,
  isContentStrategistFormatError,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import { createMarketingPlanPipelineDispatch } from "@/lib/marketing/cron/marketingCronRuntime";
import type { ContentDraftRequest } from "@/lib/marketing/bot/organization/handoffs";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";
const EVIDENCE_ID = "678ece83-840e-4c69-8344-94df1d56ae51";

const validDraftObject = {
  title: "Grand Canyon limited reopening",
  body: "Official guidance says limited access has resumed after flooding.",
  channel: "threads",
  agenda: null,
  sourceReferences: [`evidence:${EVIDENCE_ID}`],
  assignmentId: "ca_test",
  contentPlan: {
    assignmentId: "ca_test",
    factsToUse: ["Official guidance says limited access has resumed after flooding."],
    evidenceRefs: [
      {
        evidenceId: EVIDENCE_ID,
        sourceId: "src-nps",
        sourceType: "official_government",
        sourceName: "NPS",
        isOfficial: true,
        evidenceType: "official_statement",
        url: "https://example.com/gc",
        reference: null,
        excerpt: "Limited access has resumed after flooding.",
        publishedAt: "2026-09-01T00:00:00.000Z",
        observedAt: NOW.toISOString(),
        credibilityHint: 0.9,
      },
    ],
  },
};

const validDraftJson = JSON.stringify(validDraftObject);

function draftPayload(): ContentDraftRequest {
  const handoff = prepareManagerToContentHandoff(
    {
      title: "Grand Canyon limited reopening",
      summary: "After floods, limited access resumes.",
      agendaCandidateId: "65ca10e2-155e-4b99-8d69-de3c9ce8c725",
      researchBriefId: "e1d08b57-e103-473b-bf3a-8ff68452fd88",
      evidenceRefs: validDraftObject.contentPlan.evidenceRefs,
      channel: "threads",
      idempotencyKey: "g7f2-cs-format",
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

describe("G7-F2 Content Strategist structured-output reliability", () => {
  it("1: bare JSON parses", () => {
    const plan = parseContentStrategistOutput(validDraftJson);
    expect(plan.body).toContain("limited access");
    expect(plan.contentPlan?.evidenceRefs?.length).toBeGreaterThanOrEqual(1);
  });

  it("2: fenced ```json parses via shared extractor", () => {
    const raw = "```json\n" + validDraftJson + "\n```";
    const detailed = parseContentStrategistOutputDetailed(raw);
    expect(detailed.ok).toBe(true);
    if (detailed.ok) expect(detailed.extractMode).toBe("fenced_json");
  });

  it("3: prose-wrapped single object parses", () => {
    const raw = `Here is the draft:\n${validDraftJson}\nThanks.`;
    const detailed = parseContentStrategistOutputDetailed(raw);
    expect(detailed.ok).toBe(true);
    if (detailed.ok) expect(detailed.extractMode).toBe("balanced_object");
  });

  it("4: malformed JSON fails as format error", () => {
    expect(() => parseContentStrategistOutput("{not json")).toThrow(ContentStrategistFormatError);
    const detailed = parseContentStrategistOutputDetailed("{not json");
    expect(detailed.ok).toBe(false);
    if (!detailed.ok && detailed.kind === "format") {
      expect(detailed.failureClass).toMatch(/malformed|truncated|prose|fenced|empty|multiple/);
    }
  });

  it("5: truncated JSON fails", () => {
    const detailed = parseContentStrategistOutputDetailed('{"title":"x","body":"y"');
    expect(detailed.ok).toBe(false);
    if (!detailed.ok && detailed.kind === "format") {
      expect(["truncated_json", "malformed_json", "prose_wrapped_json"]).toContain(detailed.failureClass);
    }
  });

  it("6: multiple unrelated JSON objects fail", () => {
    const raw = `${validDraftJson}\n{"extra":true}`;
    const detailed = parseContentStrategistOutputDetailed(raw);
    expect(detailed.ok).toBe(false);
    if (!detailed.ok && detailed.kind === "format") {
      expect(detailed.failureClass).toBe("multiple_json_objects");
    }
  });

  it("7: format failure -> one valid retry succeeds", async () => {
    const invoke = vi
      .fn()
      .mockReturnValueOnce("Sorry, I cannot comply.")
      .mockReturnValueOnce(validDraftJson);
    const { output, diagnostics } = await requestContentStrategistDraftWithFormatRetry({
      payload: draftPayload(),
      invoke,
    });
    expect(output.body).toContain("limited access");
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(diagnostics.formatRetryUsed).toBe(true);
    expect(diagnostics.contentStrategistAttemptCount).toBe(2);
    expect(diagnostics.finalParseMode).toBe("format_retry");
    expect(diagnostics.firstAttemptFailureClass).toBeTruthy();
    expect(diagnostics.evidenceRefsPresence).toBe("present");
    expect(diagnostics.factsToUseCount).toBeGreaterThanOrEqual(1);
    expect(String(invoke.mock.calls[1]?.[0])).toContain("INVALID JSON/format");
  });

  it("8: second format failure -> ContentStrategistFormatError", async () => {
    const invoke = vi.fn().mockReturnValue("still not json {{{");
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toBeInstanceOf(ContentStrategistFormatError);
    expect(invoke).toHaveBeenCalledTimes(2);
    try {
      await requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke });
    } catch (error) {
      expect(isContentStrategistFormatError(error)).toBe(true);
      if (isContentStrategistFormatError(error)) {
        expect(error.diagnostics.contentStrategistAttemptCount).toBe(2);
        expect(error.diagnostics.formatRetryUsed).toBe(true);
        expect(error.toPipelineMessage()).toContain("content_strategist_format_failed");
      }
    }
  });

  it("9: timeout/spawn failure does not format-retry", async () => {
    const invoke = vi.fn().mockImplementation(() => {
      throw new Error("content-strategist timed out after 180000ms");
    });
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toThrow(/timed out/);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("10: evidence_refs_empty does not format-retry (grounding-retry instead)", async () => {
    const badSemantic = JSON.stringify({
      ...validDraftObject,
      contentPlan: {
        assignmentId: "ca_test",
        factsToUse: ["A factual claim without evidence."],
        evidenceRefs: [],
      },
    });
    const invoke = vi.fn().mockReturnValue(badSemantic);
    await expect(
      requestContentStrategistDraftWithFormatRetry({ payload: draftPayload(), invoke }),
    ).rejects.toThrow(/evidence_refs_empty|evidenceRefs is explicitly empty/);
    // G7-F5: one grounding repair, not format repair
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(String(invoke.mock.calls[1]?.[0])).toContain("grounding contract");
    expect(String(invoke.mock.calls[1]?.[0])).not.toContain("INVALID JSON/format");
  });

  it("11: G7-F1 hydrated evidence survives format retry", async () => {
    const invoke = vi
      .fn()
      .mockReturnValueOnce("```\nnot-json\n```")
      .mockReturnValueOnce(validDraftJson);
    const { output, diagnostics } = await requestContentStrategistDraftWithFormatRetry({
      payload: draftPayload(),
      invoke,
    });
    expect(diagnostics.formatRetryUsed).toBe(true);
    expect(output.contentPlan?.evidenceRefs?.map((e) => e.evidenceId)).toContain(EVIDENCE_ID);
    expect(diagnostics.evidenceRefsPresence).toBe("present");
  });

  it("12: fabricated empty evidence still fails after valid JSON", async () => {
    const fabricated = JSON.stringify({
      title: "x",
      body: "Official sources confirm a claim.",
      channel: "threads",
      contentPlan: {
        assignmentId: "ca_test",
        factsToUse: ["Official sources confirm a claim."],
        evidenceRefs: [],
      },
    });
    expect(() => parseContentStrategistOutput(fabricated)).toThrow(/evidence_refs_empty|evidenceRefs is explicitly empty/);
  });

  it("dispatch hermes path retries format once then surfaces pipeline message", async () => {
    const invokeHermesProfile = vi
      .fn()
      .mockReturnValueOnce("nope")
      .mockReturnValueOnce(validDraftJson)
      .mockReturnValueOnce(
        JSON.stringify({
          decision: "ALLOW",
          riskScore: 0,
          reasons: [],
          revisionHints: [],
          humanApprovalRequired: false,
          semanticAvailable: true,
        }),
      );

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: false,
      correlationId: "g7f2-test",
      invokeHermesProfile,
    });

    const payload = draftPayload();
    const mm = prepareManagerToContentHandoff(
      {
        title: payload.selectedAgenda!.title,
        summary: "After floods, limited access resumes.",
        evidenceRefs: validDraftObject.contentPlan.evidenceRefs,
        channel: "threads",
        now: NOW,
        idempotencyKey: "g7f2-dispatch",
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );

    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: mm.selectedAgenda,
        contentAssignment: mm.contentAssignment,
        contentPlanScaffold: mm.contentPlanScaffold,
      },
      dispatch,
    );
    expect(result.failure).toBeUndefined();
    expect(result.draft?.body).toContain("limited access");
    // CS invoke twice (format retry) + GA once
    expect(invokeHermesProfile).toHaveBeenCalledTimes(3);
    expect(invokeHermesProfile.mock.calls[0]?.[0]).toBe("content-strategist");
    expect(invokeHermesProfile.mock.calls[1]?.[0]).toBe("content-strategist");
  });

  it("repair prompt stays JSON-only and preserves assignment payload", () => {
    const payload = draftPayload();
    const prompt = buildContentDraftFormatRepairPrompt(payload, "malformed_json");
    expect(prompt).toContain("INVALID JSON/format");
    expect(prompt).toContain("Failure class: malformed_json");
    expect(prompt).toContain(payload.contentAssignment!.assignmentId);
  });
});
