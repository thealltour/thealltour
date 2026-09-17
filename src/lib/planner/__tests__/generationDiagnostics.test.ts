import { describe, expect, it } from "vitest";
import { NoObjectGeneratedError } from "ai";
import { JSONParseError, TypeValidationError } from "@ai-sdk/provider";
import { ZodError, z } from "zod";
import {
  extractPlannerGenerationDiagnostic,
  PLANNER_DIAG_MAX_CAUSE_DEPTH,
  PLANNER_DIAG_MAX_SCHEMA_ISSUES,
} from "@/lib/planner/generationDiagnostics";

function makeZodError(path: (string | number)[], code = "invalid_type"): ZodError {
  return new ZodError([
    {
      code: code as "invalid_type",
      path,
      message: "hidden message must not appear",
      expected: "string",
      received: "number",
    } as never,
  ]);
}

describe("extractPlannerGenerationDiagnostic", () => {
  it("classifies bare NoObjectGeneratedError", () => {
    const err = new NoObjectGeneratedError({
      message: "No object generated.",
      text: "SECRET_RAW_OUTPUT",
      response: { id: "r1", timestamp: new Date(), modelId: "m" },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined }, outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined } } as never,
      finishReason: "stop",
    });
    const d = extractPlannerGenerationDiagnostic(err);
    expect(d.sdkFailureType).toBe("no_object_generated");
    expect(d.errorName).toMatch(/NoObjectGenerated/);
    expect(d.finishReason).toBe("stop");
    expect(d.usage).toEqual(
      expect.objectContaining({ inputTokens: 10, outputTokens: 5 }),
    );
    expect(JSON.stringify(d)).not.toContain("SECRET_RAW_OUTPUT");
    expect(JSON.stringify(d)).not.toContain("message");
  });

  it("walks NoObjectGenerated → TypeValidation → cause chain", () => {
    const typeErr = new TypeValidationError({
      value: { secret: "VALUE_MUST_NOT_LOG" },
      cause: new Error("inner"),
    });
    const err = new NoObjectGeneratedError({
      message: "No object generated.",
      cause: typeErr,
      text: "RAW",
      response: { id: "r1", timestamp: new Date(), modelId: "m" },
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined } as never,
      finishReason: "error",
    });
    const d = extractPlannerGenerationDiagnostic(err);
    expect(d.sdkFailureType).toBe("type_validation");
    expect(d.causeName).toMatch(/TypeValidation/);
    expect(d.causeChain[0]).toMatch(/NoObjectGenerated/);
    expect(d.causeChain.some((n) => /TypeValidation/i.test(n))).toBe(true);
    expect(JSON.stringify(d)).not.toContain("VALUE_MUST_NOT_LOG");
    expect(JSON.stringify(d)).not.toContain("RAW");
  });

  it("extracts nested Zod issue paths and codes", () => {
    const zod = makeZodError(["days", 0, "items", 1, "time"], "invalid_string");
    const typeErr = new TypeValidationError({ value: {}, cause: zod });
    const err = new NoObjectGeneratedError({
      cause: typeErr,
      text: "x",
      response: { id: "r1", timestamp: new Date(), modelId: "m" },
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined } as never,
      finishReason: "stop",
    });
    const d = extractPlannerGenerationDiagnostic(err);
    expect(d.sdkFailureType).toBe("type_validation");
    expect(d.schemaIssuePaths).toEqual([
      { path: "days.0.items.1.time", code: "invalid_string" },
    ]);
    expect(JSON.stringify(d)).not.toContain("hidden message");
  });

  it("classifies JSONParseError", () => {
    const parseErr = new JSONParseError({
      text: '{"bad":',
      cause: new Error("Unexpected end"),
    });
    const d = extractPlannerGenerationDiagnostic(parseErr);
    expect(d.sdkFailureType).toBe("json_parse");
    expect(d.errorName).toMatch(/JSONParse/);
    expect(JSON.stringify(d)).not.toContain('{"bad":');
  });

  it("handles unknown nested cause gracefully", () => {
    const err = new Error("top");
    (err as Error & { cause: unknown }).cause = { weird: true };
    const d = extractPlannerGenerationDiagnostic(err);
    expect(d.sdkFailureType).toBe("unknown");
    expect(d.causeChain.length).toBeGreaterThanOrEqual(1);
  });

  it("bounds cyclic cause references", () => {
    const a = new Error("a");
    const b = new Error("b");
    (a as Error & { cause: unknown }).cause = b;
    (b as Error & { cause: unknown }).cause = a;
    const d = extractPlannerGenerationDiagnostic(a);
    expect(d.causeChain.length).toBeLessThanOrEqual(PLANNER_DIAG_MAX_CAUSE_DEPTH);
    expect(d.causeChain).toContain("cyclic");
  });

  it("bounds cause depth", () => {
    let tip: Error = new Error("leaf");
    for (let i = 0; i < 10; i += 1) {
      const next = new Error(`e${i}`);
      (next as Error & { cause: unknown }).cause = tip;
      tip = next;
    }
    const d = extractPlannerGenerationDiagnostic(tip);
    expect(d.causeChain.length).toBeLessThanOrEqual(PLANNER_DIAG_MAX_CAUSE_DEPTH);
  });

  it("caps schema issues at 20", () => {
    const issues = Array.from({ length: 40 }, (_, i) => ({
      code: "custom" as const,
      path: ["days", i],
      message: `msg-${i}-secret`,
    }));
    const zod = new ZodError(issues as never);
    const d = extractPlannerGenerationDiagnostic(zod);
    expect(d.schemaIssuePaths?.length).toBe(PLANNER_DIAG_MAX_SCHEMA_ISSUES);
    expect(JSON.stringify(d)).not.toContain("secret");
  });

  it("does not include prompt or raw response fields", () => {
    const err = new NoObjectGeneratedError({
      message: "fail",
      text: "PROMPT_LEAK_CHECK",
      response: { id: "r", timestamp: new Date(), modelId: "m" },
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } as never,
      finishReason: "length",
    });
    const d = extractPlannerGenerationDiagnostic(err);
    const serialized = JSON.stringify(d);
    expect(serialized).not.toContain("PROMPT_LEAK_CHECK");
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("anonymousKey");
    expect(d.finishReason).toBe("length");
  });
});

describe("zod structural detection", () => {
  it("detects ZodError from safeParse", () => {
    const parsed = z.object({ a: z.string() }).safeParse({ a: 1 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const d = extractPlannerGenerationDiagnostic(parsed.error);
    expect(d.schemaIssuePaths?.[0]?.path).toBe("a");
    expect(d.errorName).toBe("ZodError");
  });
});
