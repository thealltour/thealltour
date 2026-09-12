/**
 * Shortform narration composer — LLM when provided, else deterministic fallback.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
  type PublishableNarrationSegment,
} from "@/lib/marketing/publishable/contracts";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeShortformNarrationDeterministic } from "@/lib/marketing/publishable/shortform/deterministicShortform";
import { SHORTFORM_NARRATION_WRITING_CONTRACT } from "@/lib/marketing/publishable/shortform/writingContract";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

function buildShortformPrompt(input: PublishableComposerInput): string {
  return [
    SHORTFORM_NARRATION_WRITING_CONTRACT,
    "INPUT_JSON:",
    JSON.stringify({
      topic: input.topic,
      commercialIntent: input.commercialIntent,
      destinations: input.destinations,
      keyMessage: input.keyMessage,
      usableFacts: input.usableFacts.map((f) => ({
        statement: f.statement,
        confidence: f.confidence,
      })),
      unsupportedClaims: input.unsupportedClaims,
      governanceDecision: input.governanceDecision,
    }),
  ].join("\n");
}

function parseShortformJson(
  raw: string,
  input: PublishableComposerInput,
): { body: string; segments: PublishableNarrationSegment[] } | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      body?: unknown;
      segments?: unknown;
    };
    if (!Array.isArray(parsed.segments) || parsed.segments.length < 1) return null;
    const segments: PublishableNarrationSegment[] = [];
    for (const [index, item] of parsed.segments.entries()) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const narrationText =
        typeof rec.narrationText === "string" ? stripEvidenceIdsFromText(rec.narrationText) : "";
      if (!narrationText) continue;
      const purpose =
        typeof rec.purpose === "string" && rec.purpose.trim()
          ? rec.purpose.trim().slice(0, 64)
          : index === 0
            ? "hook"
            : "body";
      const visualIntent =
        typeof rec.visualIntent === "string" && rec.visualIntent.trim()
          ? stripEvidenceIdsFromText(rec.visualIntent).slice(0, 400)
          : input.destinations[0]
            ? `${input.destinations[0]} travel visual`
            : "travel lifestyle visual";
      segments.push({
        segmentId: `narr-${String(segments.length + 1).padStart(2, "0")}`,
        narrationText: narrationText.slice(0, 2000),
        subtitleText: narrationText.slice(0, 2000),
        purpose,
        visualIntent,
        evidenceRefs: input.evidenceRefIds.slice(0, 4),
      });
    }
    if (segments.length < 1) return null;
    if (segments.length > 1) {
      segments[segments.length - 1]!.purpose = "close";
    }
    const body =
      typeof parsed.body === "string" && parsed.body.trim()
        ? stripEvidenceIdsFromText(parsed.body)
        : segments.map((s) => s.narrationText).join("\n\n");
    return { body, segments: segments.slice(0, 8) };
  } catch {
    return null;
  }
}

export async function composeShortformNarration(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
  invoke?: PublishableLlmInvoke | null;
}): Promise<PublishableChannelContent> {
  const nowIso = (input.now ?? new Date()).toISOString();
  let body = "";
  let segments: PublishableNarrationSegment[] = [];
  let composer: PublishableChannelContent["provenance"]["composer"] = "deterministic_fallback";
  let status: PublishableChannelContent["status"] = "fallback_generated";

  if (input.invoke) {
    try {
      const raw = await input.invoke(buildShortformPrompt(input.composerInput));
      const parsed = parseShortformJson(
        typeof raw === "string" ? raw : String(raw),
        input.composerInput,
      );
      if (parsed) {
        const validation = validatePublishableText(parsed.body);
        const segOk = parsed.segments.every((s) => validatePublishableText(s.narrationText).ok);
        if (validation.ok && segOk) {
          body = parsed.body;
          segments = parsed.segments;
          composer = "llm";
          status = "generated";
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (!body || segments.length < 1) {
    const det = composeShortformNarrationDeterministic(input.composerInput);
    body = det.body;
    segments = det.segments;
    composer = "deterministic_fallback";
    status = "fallback_generated";
  }

  const validation = validatePublishableText(body);
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "shortform",
    format: "short_video_narration",
    title: null,
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
    narrationSegments: segments,
  };
}
