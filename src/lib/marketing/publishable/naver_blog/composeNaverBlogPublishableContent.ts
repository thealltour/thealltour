import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeNaverBlogPublishableDeterministic } from "@/lib/marketing/publishable/naver_blog/deterministicBlog";
import { NAVER_BLOG_WRITING_CONTRACT } from "@/lib/marketing/publishable/naver_blog/writingContract";
import {
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";

function buildPrompt(input: PublishableComposerInput): string {
  return [
    NAVER_BLOG_WRITING_CONTRACT,
    "INPUT_JSON:",
    JSON.stringify({
      topic: input.topic,
      audience: input.audience,
      commercialIntent: input.commercialIntent,
      keyMessage: input.keyMessage,
      destinations: input.destinations,
      usableFacts: input.usableFacts.map((f) => ({
        statement: f.statement,
        confidence: f.confidence,
        type: f.epistemicType ?? null,
      })),
      avoidedStatements: input.avoidedStatements,
      unsupportedClaims: input.unsupportedClaims,
      research: input.research,
    }),
  ].join("\n");
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
      ? parsed.faq
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            const question = typeof row.question === "string" ? stripEvidenceIdsFromText(row.question) : "";
            const answer = typeof row.answer === "string" ? stripEvidenceIdsFromText(row.answer) : "";
            if (!question || !answer) return null;
            return { question, answer };
          })
          .filter(Boolean) as Array<{ question: string; answer: string }>
      : [];
    return {
      title: selectedTitle,
      body: body.startsWith("#") ? body : `# ${selectedTitle}\n\n${body}`,
      titleCandidates: titleCandidates.length >= 3 ? titleCandidates : [...titleCandidates, selectedTitle].slice(0, 5),
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

export async function composeNaverBlogPublishableContent(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
  invoke?: PublishableLlmInvoke | null;
}): Promise<PublishableChannelContent> {
  const nowIso = (input.now ?? new Date()).toISOString();
  let composer: PublishableChannelContent["provenance"]["composer"] = "deterministic_fallback";
  let status: PublishableChannelContent["status"] = "fallback_generated";
  let det = composeNaverBlogPublishableDeterministic(input.composerInput);

  if (input.invoke) {
    try {
      const raw = await input.invoke(buildPrompt(input.composerInput));
      const parsed = parseBlogJson(typeof raw === "string" ? raw : String(raw));
      if (parsed) {
        const validation = validatePublishableText(parsed.body, {
          channel: "naver_blog",
          title: parsed.title,
          primaryTopic: parsed.primaryTopic,
          allowHeadings: true,
        });
        if (validation.ok) {
          det = {
            title: parsed.title,
            body: parsed.body,
            blogMeta: {
              selectedTitle: parsed.title,
              titleCandidates: parsed.titleCandidates,
              primaryTopic: parsed.primaryTopic,
              searchIntent: parsed.searchIntent ?? input.composerInput.research?.searchIntentPrimary ?? null,
              sectionPlan: parsed.sectionPlan,
              faq: parsed.faq,
              cta: parsed.cta,
            },
          };
          composer = "llm";
          status = "generated";
        }
      }
    } catch {
      /* fallback */
    }
  }

  const validation = validatePublishableText(det.body, {
    channel: "naver_blog",
    title: det.title,
    primaryTopic: det.blogMeta.primaryTopic,
    allowHeadings: true,
  });

  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "naver_blog",
    format: "naver_blog_article",
    title: det.title,
    body: det.body,
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
    validation,
    blogMeta: det.blogMeta,
  };
}
