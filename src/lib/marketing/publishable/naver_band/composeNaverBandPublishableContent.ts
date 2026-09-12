import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeNaverBandPublishableDeterministic } from "@/lib/marketing/publishable/naver_band/deterministicBand";
import { NAVER_BAND_WRITING_CONTRACT } from "@/lib/marketing/publishable/naver_band/writingContract";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";

function buildPrompt(input: PublishableComposerInput): string {
  return [
    NAVER_BAND_WRITING_CONTRACT,
    "INPUT_JSON:",
    JSON.stringify({
      topic: input.topic,
      audience: input.audience,
      commercialIntent: input.commercialIntent,
      keyMessage: input.keyMessage,
      research: {
        selectedAngle: input.research?.selectedAngle,
        audiencePrimary: input.research?.audiencePrimary,
        anxieties: input.research?.anxieties,
        questions: input.research?.searchQuestions,
        motivations: input.research?.motivations,
      },
      usableFacts: input.usableFacts.map((f) => ({
        statement: f.statement,
        type: f.epistemicType ?? null,
      })),
      avoidedStatements: input.avoidedStatements,
    }),
  ].join("\n");
}

function parseBodyJson(raw: string): { title: string | null; body: string } | null {
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

export async function composeNaverBandPublishableContent(input: {
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
      const raw = await input.invoke(buildPrompt(input.composerInput));
      const parsed = parseBodyJson(typeof raw === "string" ? raw : String(raw));
      if (parsed) {
        const validation = validatePublishableText(parsed.body, { channel: "naver_band" });
        if (validation.ok) {
          title = parsed.title;
          body = parsed.body;
          composer = "llm";
          status = "generated";
        }
      }
    } catch {
      /* fallback */
    }
  }

  if (!body) {
    const det = composeNaverBandPublishableDeterministic(input.composerInput);
    title = det.title;
    body = det.body;
    composer = "deterministic_fallback";
    status = "fallback_generated";
  }

  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "naver_band",
    format: "naver_band_post",
    title,
    body,
    status,
    generatedAt: nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    selectedAngleRef: input.composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: input.composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer,
      evidenceRefIds: input.composerInput.evidenceRefIds,
      commercialIntent: input.composerInput.commercialIntent,
    },
    validation: validatePublishableText(body, { channel: "naver_band" }),
  };
}
