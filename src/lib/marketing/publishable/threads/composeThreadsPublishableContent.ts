/**
 * Threads publishable composer — LLM when provided, else deterministic fallback.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeThreadsPublishableDeterministic } from "@/lib/marketing/publishable/threads/deterministicThreads";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

export type PublishableLlmInvoke = (prompt: string) => Promise<string> | string;

function buildThreadsPrompt(input: PublishableComposerInput): string {
  return [
    THREADS_WRITING_CONTRACT,
    "INPUT_JSON:",
    JSON.stringify({
      topic: input.topic,
      audience: input.audience,
      commercialIntent: input.commercialIntent,
      hookHint: input.hookHint,
      keyMessage: input.keyMessage,
      destinations: input.destinations,
      usableFacts: input.usableFacts.map((f) => ({
        statement: f.statement,
        confidence: f.confidence,
      })),
      avoidedStatements: input.avoidedStatements,
      unsupportedClaims: input.unsupportedClaims,
      governanceDecision: input.governanceDecision,
    }),
  ].join("\n");
}

function parseThreadsJson(raw: string): { title: string | null; body: string } | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      title?: unknown;
      body?: unknown;
    };
    const body = typeof parsed.body === "string" ? stripEvidenceIdsFromText(parsed.body) : "";
    if (!body) return null;
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? stripEvidenceIdsFromText(parsed.title)
        : null;
    return { title, body };
  } catch {
    return null;
  }
}

export async function composeThreadsPublishableContent(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
  invoke?: PublishableLlmInvoke | null;
}): Promise<PublishableChannelContent> {
  const nowIso = (input.now ?? new Date()).toISOString();
  let title: string | null = null;
  let body = "";
  let composer: PublishableChannelContent["provenance"]["composer"] = "deterministic_fallback";
  let status: PublishableChannelContent["status"] = "fallback_generated";

  if (input.invoke) {
    try {
      const raw = await input.invoke(buildThreadsPrompt(input.composerInput));
      const parsed = parseThreadsJson(typeof raw === "string" ? raw : String(raw));
      if (parsed) {
        const validation = validatePublishableText(parsed.body);
        if (validation.ok) {
          title = parsed.title;
          body = parsed.body;
          composer = "llm";
          status = "generated";
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (!body) {
    const det = composeThreadsPublishableDeterministic(input.composerInput);
    title = det.title;
    body = det.body;
    composer = "deterministic_fallback";
    status = "fallback_generated";
  }

  const validation = validatePublishableText(body);
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "threads",
    format: "threads_text",
    title,
    body,
    status: validation.ok ? status : "generated",
    generatedAt: nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    provenance: {
      composer,
      evidenceRefIds: input.composerInput.evidenceRefIds,
      commercialIntent: input.composerInput.commercialIntent,
    },
    validation,
  };
}
