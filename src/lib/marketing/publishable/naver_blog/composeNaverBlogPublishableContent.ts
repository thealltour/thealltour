/**
 * Naver Blog publishable composer — LLM required for publishable success.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableBlogMeta,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  PROPOSITION_COMPOSER_RULES,
  bodyReflectsPropositionTakeaway,
  buildPropositionPromptSlice,
  buildPropositionProvenance,
  invokeWithBoundedRepair,
  propositionBlocksPolishedGeneration,
  resolveFailureStatus,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeNaverBlogPublishableDeterministic } from "@/lib/marketing/publishable/naver_blog/deterministicBlog";
import { NAVER_BLOG_WRITING_CONTRACT } from "@/lib/marketing/publishable/naver_blog/writingContract";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";

function buildPrompt(input: PublishableComposerInput, repairHint?: string | null): string {
  return [
    NAVER_BLOG_WRITING_CONTRACT,
    PROPOSITION_COMPOSER_RULES,
    "Channel: search/problem-solving article around ContentProposition promise/takeaways.",
    repairHint ?? "",
    "INPUT_JSON:",
    JSON.stringify({
      topic: input.topic,
      audience: input.audience,
      commercialIntent: input.commercialIntent,
      keyMessage: input.keyMessage,
      destinations: input.destinations,
      contentProposition: buildPropositionPromptSlice(input.contentProposition),
      usableFacts: input.usableFacts.map((f) => ({
        statement: f.statement,
        confidence: f.confidence,
        type: f.epistemicType ?? null,
      })),
      avoidedStatements: input.avoidedStatements,
      unsupportedClaims: input.unsupportedClaims,
      research: input.research,
    }),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseBlogJson(raw: string): {
  title: string;
  body: string;
  titleCandidates: string[];
  primaryTopic: string;
  searchIntent: string | null;
  sectionPlan: string[];
  faq: Array<{ question: string; answer: string }>;
  cta: string | null;
} | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const bodyMarkdown =
      typeof parsed.bodyMarkdown === "string"
        ? parsed.bodyMarkdown
        : typeof parsed.body === "string"
          ? parsed.body
          : "";
    const body = stripEvidenceIdsFromText(bodyMarkdown);
    const selectedTitle =
      typeof parsed.selectedTitle === "string"
        ? stripEvidenceIdsFromText(parsed.selectedTitle)
        : typeof parsed.title === "string"
          ? stripEvidenceIdsFromText(parsed.title)
          : "";
    if (!body || !selectedTitle) return null;
    const titleCandidates = Array.isArray(parsed.titleCandidates)
      ? parsed.titleCandidates.map(String).map(stripEvidenceIdsFromText).filter(Boolean).slice(0, 5)
      : [selectedTitle];
    const faq = Array.isArray(parsed.faq)
      ? (parsed.faq
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            const question = typeof row.question === "string" ? stripEvidenceIdsFromText(row.question) : "";
            const answer = typeof row.answer === "string" ? stripEvidenceIdsFromText(row.answer) : "";
            if (!question || !answer) return null;
            return { question, answer };
          })
          .filter(Boolean) as Array<{ question: string; answer: string }>)
      : [];
    return {
      title: selectedTitle,
      body: body.startsWith("#") ? body : `# ${selectedTitle}\n\n${body}`,
      titleCandidates:
        titleCandidates.length >= 3
          ? titleCandidates
          : [...titleCandidates, selectedTitle].slice(0, 5),
      primaryTopic:
        typeof parsed.primaryTopic === "string"
          ? stripEvidenceIdsFromText(parsed.primaryTopic)
          : selectedTitle.slice(0, 40),
      searchIntent: typeof parsed.searchIntent === "string" ? parsed.searchIntent : null,
      sectionPlan: Array.isArray(parsed.sectionPlan)
        ? parsed.sectionPlan.map(String).slice(0, 8)
        : [],
      faq,
      cta: typeof parsed.cta === "string" ? stripEvidenceIdsFromText(parsed.cta) : null,
    };
  } catch {
    return null;
  }
}

function wrap(input: {
  composerInput: PublishableComposerInput;
  nowIso: string;
  title: string | null;
  body: string;
  blogMeta: PublishableBlogMeta;
  status: PublishableChannelContent["status"];
  composer: PublishableChannelContent["provenance"]["composer"];
  generationMode: NonNullable<PublishableChannelContent["provenance"]["generationMode"]>;
  attemptCount: number;
  latencyMs: number | null;
  failureCategory?: PublishableChannelContent["provenance"]["failureCategory"];
  failureMessage?: string | null;
  modelProfile?: string | null;
}): PublishableChannelContent {
  const validation = validatePublishableText(input.body, {
    channel: "naver_blog",
    title: input.title,
    primaryTopic: input.blogMeta.primaryTopic,
    allowHeadings: true,
  });
  const publishableSuccess =
    input.composer === "llm" && input.status === "generated" && validation.ok;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "naver_blog",
    format: "naver_blog_article",
    title: input.title,
    body: input.body,
    status: input.status,
    generatedAt: input.nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    selectedAngleRef: input.composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: input.composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer: input.composer,
      evidenceRefIds: input.composerInput.evidenceRefIds,
      commercialIntent: input.composerInput.commercialIntent,
      generationMode: input.generationMode,
      modelProfile: input.modelProfile ?? null,
      attemptCount: input.attemptCount,
      latencyMs: input.latencyMs,
      failureCategory: input.failureCategory ?? null,
      failureMessage: input.failureMessage ?? null,
      propositionStrength: input.composerInput.contentProposition?.propositionStrength ?? null,
      proposition: buildPropositionProvenance(input.composerInput),
    },
    validation,
    publishableSuccess,
    needsRegeneration: !publishableSuccess,
    blogMeta: input.blogMeta,
  };
}

export async function composeNaverBlogPublishableContent(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
  invoke?: PublishableLlmInvoke | null;
  modelProfile?: string | null;
  allowDeterministicFallback?: boolean;
}): Promise<PublishableChannelContent> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  const allowFallback = input.allowDeterministicFallback !== false;
  const fallbackDet = () => composeNaverBlogPublishableDeterministic(input.composerInput);

  if (propositionBlocksPolishedGeneration(input.composerInput.contentProposition)) {
    const det = allowFallback
      ? fallbackDet()
      : {
          title: null,
          body: "[generation skipped: insufficient content proposition]",
          blogMeta: {
            selectedTitle: "",
            titleCandidates: [],
            primaryTopic: "",
            searchIntent: null,
            sectionPlan: [],
            faq: [],
            cta: null,
          },
        };
    return wrap({
      composerInput: input.composerInput,
      nowIso,
      title: det.title,
      body: det.body,
      blogMeta: det.blogMeta,
      status: "generation_failed",
      composer: "deterministic_fallback",
      generationMode: "skipped",
      attemptCount: 0,
      latencyMs: Date.now() - started,
      failureCategory: "insufficient_proposition",
      failureMessage: "propositionStrength=insufficient",
      modelProfile: input.modelProfile,
    });
  }

  if (input.invoke) {
    const result = await invokeWithBoundedRepair({
      invoke: input.invoke,
      buildPrompt: (hint) => buildPrompt(input.composerInput, hint),
      parseAndValidate: (raw) => {
        const parsed = parseBlogJson(raw);
        if (!parsed) return { ok: false, category: "invalid_json", message: "blog_json_parse_failed" };
        const validation = validatePublishableText(parsed.body, {
          channel: "naver_blog",
          title: parsed.title,
          primaryTopic: parsed.primaryTopic,
          allowHeadings: true,
        });
        if (!validation.ok) {
          return {
            ok: false,
            category: "publishability_validation",
            message: validation.issues.map((i) => i.code).join(","),
          };
        }
        if (!bodyReflectsPropositionTakeaway(parsed.body, input.composerInput.contentProposition)) {
          return {
            ok: false,
            category: "publishability_validation",
            message: "proposition_takeaway_not_reflected",
          };
        }
        return { ok: true };
      },
    });
    if (result.success && result.raw) {
      const parsed = parseBlogJson(result.raw)!;
      return wrap({
        composerInput: input.composerInput,
        nowIso,
        title: parsed.title,
        body: parsed.body,
        blogMeta: {
          selectedTitle: parsed.title,
          titleCandidates: parsed.titleCandidates,
          primaryTopic: parsed.primaryTopic,
          searchIntent:
            parsed.searchIntent ?? input.composerInput.research?.searchIntentPrimary ?? null,
          sectionPlan: parsed.sectionPlan,
          faq: parsed.faq,
          cta: parsed.cta,
        },
        status: "generated",
        composer: "llm",
        generationMode: "llm",
        attemptCount: result.attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: input.modelProfile,
      });
    }
    const det = allowFallback
      ? fallbackDet()
      : {
          title: null,
          body: "[generation failed]",
          blogMeta: {
            selectedTitle: "",
            titleCandidates: [],
            primaryTopic: "",
            searchIntent: null,
            sectionPlan: [],
            faq: [],
            cta: null,
          },
        };
    return wrap({
      composerInput: input.composerInput,
      nowIso,
      title: det.title,
      body: det.body,
      blogMeta: det.blogMeta,
      status: resolveFailureStatus({ llmAttempted: true, category: result.failureCategory }),
      composer: "deterministic_fallback",
      generationMode: "fallback",
      attemptCount: result.attemptCount,
      latencyMs: Date.now() - started,
      failureCategory: result.failureCategory ?? "unknown",
      failureMessage: result.failureMessage ?? "llm_compose_failed",
      modelProfile: input.modelProfile,
    });
  }

  const det = fallbackDet();
  return wrap({
    composerInput: input.composerInput,
    nowIso,
    title: det.title,
    body: det.body,
    blogMeta: det.blogMeta,
    status: "fallback_generated",
    composer: "deterministic_fallback",
    generationMode: "fallback",
    attemptCount: 0,
    latencyMs: Date.now() - started,
    failureCategory: "invoke_missing",
    failureMessage: "no PublishableLlmInvoke supplied",
    modelProfile: input.modelProfile,
  });
}
