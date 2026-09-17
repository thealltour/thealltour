/**
 * Production-safe diagnostics for Planner AI generation failures.
 * Never logs prompt, raw text, response body, or PII.
 */

import { NoObjectGeneratedError } from "ai";
import { JSONParseError, TypeValidationError } from "@ai-sdk/provider";
import type { ZodError } from "zod";

export const PLANNER_DIAG_MAX_CAUSE_DEPTH = 4;
export const PLANNER_DIAG_MAX_SCHEMA_ISSUES = 20;
export const PLANNER_DIAG_MAX_PATH_LENGTH = 120;

export type PlannerSdkFailureType =
  | "no_object_generated"
  | "type_validation"
  | "json_parse"
  | "provider"
  | "unknown";

export type PlannerSchemaIssuePath = {
  path: string;
  code: string;
};

export type PlannerUsageDiagnostic = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type PlannerRootCauseDiagnostic = {
  errorName: string | null;
  causeName: string | null;
  causeChain: string[];
  schemaIssuePaths: PlannerSchemaIssuePath[] | null;
  sdkFailureType: PlannerSdkFailureType;
  finishReason: string | null;
  usage: PlannerUsageDiagnostic | null;
};

function errorDisplayName(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const name = (error as { name?: unknown }).name;
  if (typeof name === "string" && name.trim()) return name.trim();
  if (error instanceof Error && error.constructor?.name) return error.constructor.name;
  return null;
}

function getCause(error: unknown): unknown {
  if (!error || typeof error !== "object") return undefined;
  if (!("cause" in error)) return undefined;
  return (error as { cause?: unknown }).cause;
}

function isZodErrorLike(error: unknown): error is ZodError {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { name?: string }).name === "ZodError" &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

function truncatePath(path: string): string {
  if (path.length <= PLANNER_DIAG_MAX_PATH_LENGTH) return path;
  return `${path.slice(0, PLANNER_DIAG_MAX_PATH_LENGTH - 1)}…`;
}

export function extractZodIssuePaths(error: unknown): PlannerSchemaIssuePath[] | null {
  const visited = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < PLANNER_DIAG_MAX_CAUSE_DEPTH + 1; depth += 1) {
    if (current == null || visited.has(current)) break;
    visited.add(current);
    if (isZodErrorLike(current)) {
      const seen = new Set<string>();
      const out: PlannerSchemaIssuePath[] = [];
      for (const issue of current.issues) {
        const path = truncatePath(
          Array.isArray(issue.path) ? issue.path.map(String).join(".") : "",
        );
        const code = typeof issue.code === "string" ? issue.code : "unknown";
        const key = `${path}|${code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ path, code });
        if (out.length >= PLANNER_DIAG_MAX_SCHEMA_ISSUES) break;
      }
      return out.length > 0 ? out : [];
    }
    current = getCause(current);
  }
  return null;
}

export function extractCauseChain(error: unknown): string[] {
  const chain: string[] = [];
  const visited = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < PLANNER_DIAG_MAX_CAUSE_DEPTH; depth += 1) {
    if (current == null) break;
    if (visited.has(current)) {
      chain.push("cyclic");
      break;
    }
    visited.add(current);
    const name = errorDisplayName(current);
    if (name) chain.push(name);
    else if (typeof current === "string") chain.push("string");
    else chain.push("unknown");
    current = getCause(current);
  }

  return chain;
}

function extractFinishReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (!("finishReason" in error)) return null;
  const reason = (error as { finishReason?: unknown }).finishReason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function extractUsage(error: unknown): PlannerUsageDiagnostic | null {
  if (!error || typeof error !== "object") return null;
  if (!("usage" in error)) return null;
  const usage = (error as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return null;

  const u = usage as Record<string, unknown>;
  const out: PlannerUsageDiagnostic = {};
  if (typeof u.inputTokens === "number" && Number.isFinite(u.inputTokens)) {
    out.inputTokens = u.inputTokens;
  }
  if (typeof u.outputTokens === "number" && Number.isFinite(u.outputTokens)) {
    out.outputTokens = u.outputTokens;
  }
  if (typeof u.totalTokens === "number" && Number.isFinite(u.totalTokens)) {
    out.totalTokens = u.totalTokens;
  }
  // Some SDK shapes use promptTokens/completionTokens
  if (out.inputTokens == null && typeof u.promptTokens === "number") {
    out.inputTokens = u.promptTokens;
  }
  if (out.outputTokens == null && typeof u.completionTokens === "number") {
    out.outputTokens = u.completionTokens;
  }

  return Object.keys(out).length > 0 ? out : null;
}

function classifySdkFailureType(error: unknown, chain: string[]): PlannerSdkFailureType {
  let current: unknown = error;
  const visited = new Set<unknown>();
  for (let depth = 0; depth < PLANNER_DIAG_MAX_CAUSE_DEPTH; depth += 1) {
    if (current == null || visited.has(current)) break;
    visited.add(current);
    if (JSONParseError.isInstance(current)) return "json_parse";
    if (TypeValidationError.isInstance(current)) return "type_validation";
    current = getCause(current);
  }

  if (chain.some((n) => /JSONParse/i.test(n))) return "json_parse";
  if (chain.some((n) => /TypeValidation/i.test(n))) return "type_validation";
  if (
    NoObjectGeneratedError.isInstance(error) ||
    chain.some((n) => /NoObjectGenerated/i.test(n))
  ) {
    return "no_object_generated";
  }
  if (chain.some((n) => /APICall|Provider|Fetch|Network/i.test(n))) return "provider";
  return "unknown";
}

/**
 * Extract production-safe root-cause diagnostics from any thrown generation error.
 */
export function extractPlannerGenerationDiagnostic(
  error: unknown,
): PlannerRootCauseDiagnostic {
  const causeChain = extractCauseChain(error);
  const errorName = errorDisplayName(error);
  const causeName = causeChain.length > 1 ? causeChain[1]! : null;
  const schemaIssuePaths = extractZodIssuePaths(error);
  const sdkFailureType = classifySdkFailureType(error, causeChain);

  // Prefer finishReason/usage on the top-level NoObjectGeneratedError when present.
  let finishReason = extractFinishReason(error);
  let usage = extractUsage(error);
  if ((finishReason == null || usage == null) && error && typeof error === "object") {
    let current: unknown = getCause(error);
    const visited = new Set<unknown>([error]);
    for (let depth = 0; depth < PLANNER_DIAG_MAX_CAUSE_DEPTH; depth += 1) {
      if (current == null || visited.has(current)) break;
      visited.add(current);
      if (finishReason == null) finishReason = extractFinishReason(current);
      if (usage == null) usage = extractUsage(current);
      current = getCause(current);
    }
  }

  return {
    errorName,
    causeName,
    causeChain,
    schemaIssuePaths,
    sdkFailureType,
    finishReason,
    usage,
  };
}

/** Fields safe to merge into server logs (no message/text/prompt). */
export function toPlannerDiagnosticLogFields(
  diagnostic: PlannerRootCauseDiagnostic | null | undefined,
): Record<string, unknown> {
  if (!diagnostic) {
    return {
      sdkFailureType: null,
      causeName: null,
      causeChain: null,
      schemaIssuePaths: null,
      finishReason: null,
      usage: null,
    };
  }
  return {
    sdkFailureType: diagnostic.sdkFailureType,
    causeName: diagnostic.causeName,
    causeChain: diagnostic.causeChain,
    schemaIssuePaths: diagnostic.schemaIssuePaths,
    finishReason: diagnostic.finishReason,
    usage: diagnostic.usage,
    errorName: diagnostic.errorName,
  };
}
