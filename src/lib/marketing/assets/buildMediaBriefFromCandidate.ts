import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { AssignmentEvidenceRef, ContentFormatKind, ContentFormatRecommendation } from "@/lib/marketing/content/types";
import {
  MEDIA_BRIEF_CONTRACT,
  type CardNewsCard,
  type MediaBrief,
  type MediaBriefFactualClaim,
  type ShortformNarrationSegment,
} from "@/lib/marketing/assets/contracts";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import { assertSafeCandidateId, splitBusinessDateParts } from "@/lib/marketing/assets/paths";

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

function collectEvidenceCatalog(candidate: CompletedMarketingCandidate): Map<string, AssignmentEvidenceRef> {
  const catalog = new Map<string, AssignmentEvidenceRef>();
  const sources = [
    candidate.contentAssignment.evidenceRefs,
    candidate.selectedAgenda.evidenceRefs,
    candidate.contentPlan?.evidenceRefs ?? [],
  ];
  for (const list of sources) {
    for (const ref of list) {
      if (!catalog.has(ref.evidenceId)) catalog.set(ref.evidenceId, ref);
    }
  }
  return catalog;
}

function knownEvidenceIds(catalog: Map<string, AssignmentEvidenceRef>, refs: string[]): string[] {
  return uniqueStrings(refs.filter((id) => catalog.has(id)));
}

function recommendedFormats(candidate: CompletedMarketingCandidate): ContentFormatRecommendation[] {
  return candidate.contentPlan?.recommendedFormats ?? candidate.contentAssignment.formatHints ?? [];
}

function hasFormat(formats: ContentFormatRecommendation[], kind: ContentFormatKind): boolean {
  return formats.some((item) => item.format === kind);
}

function buildFactualClaims(
  candidate: CompletedMarketingCandidate,
  catalog: Map<string, AssignmentEvidenceRef>,
): MediaBriefFactualClaim[] {
  return candidate.contentAssignment.facts.map((fact) => ({
    factId: fact.factId,
    statement: fact.statement,
    evidenceRefs: knownEvidenceIds(catalog, fact.evidenceRefs),
    confidence: fact.confidence,
  }));
}

function buildCardNewsCards(candidate: CompletedMarketingCandidate): CardNewsCard[] {
  const cards: CardNewsCard[] = [];
  const title = candidate.draft.title?.trim() || candidate.selectedAgenda.title;
  const hook = candidate.contentPlan?.hook?.trim() || null;
  const outline = candidate.contentPlan?.outline ?? [];
  const cta = candidate.contentPlan?.ctaStrategy?.trim() || null;

  if (title) {
    cards.push({
      cardId: "card-cover",
      role: "cover",
      headline: title,
      body: hook && hook !== title ? hook : candidate.selectedAgenda.summary,
      visualIntent: "",
      evidenceRefs: [],
    });
  }

  for (const [index, item] of outline.entries()) {
    const headline = item.trim();
    if (!headline) continue;
    cards.push({
      cardId: `card-info-${String(index + 1).padStart(2, "0")}`,
      role: "information",
      headline,
      body: "",
      visualIntent: "",
      evidenceRefs: [],
    });
  }

  if (cta) {
    cards.push({
      cardId: "card-cta",
      role: "cta",
      headline: cta,
      body: "",
      visualIntent: "",
      evidenceRefs: [],
    });
  }

  return cards.slice(0, 12);
}

function splitNarrationSegments(body: string): ShortformNarrationSegment[] {
  const chunks = body
    .split(/\n{2,}|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return chunks.slice(0, 16).map((text, index) => ({
    segmentId: `narr-${String(index + 1).padStart(2, "0")}`,
    narrationText: text,
    subtitleText: text,
    purpose: "narration",
    visualIntent: "",
    evidenceRefs: [],
  }));
}

export function buildMediaBriefFromCandidate(candidate: CompletedMarketingCandidate): MediaBrief {
  assertSafeCandidateId(candidate.candidateId);
  splitBusinessDateParts(candidate.businessDateKst);

  const catalog = collectEvidenceCatalog(candidate);
  const formats = recommendedFormats(candidate);
  const factualClaims = buildFactualClaims(candidate, catalog);
  const claimEvidenceIds = uniqueStrings(factualClaims.flatMap((fact) => fact.evidenceRefs));
  const evidenceRefs = claimEvidenceIds
    .map((id) => catalog.get(id))
    .filter((ref): ref is AssignmentEvidenceRef => ref != null);

  const cardnewsEnabled = hasFormat(formats, "instagram_carousel");
  const shortformEnabled = hasFormat(formats, "short_video_concept");
  const draftTitle = candidate.draft.title?.trim() || null;
  const draftBody = candidate.draft.body?.trim() || null;

  const brief: MediaBrief = {
    contract: MEDIA_BRIEF_CONTRACT,
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
    sourceChannel: candidate.draft.channel?.trim() || null,
    targetChannels: uniqueStrings([candidate.draft.channel]),
    contentIntent: candidate.contentAssignment.objective?.trim() || candidate.contentAssignment.commercialIntent,
    audience: candidate.contentPlan?.targetAudience?.trim() || candidate.contentAssignment.audience?.trim() || null,
    coreMessage:
      candidate.contentPlan?.keyMessage?.trim() ||
      candidate.selectedAgenda.summary?.trim() ||
      null,
    factualClaims,
    evidenceRefs,
    cta: candidate.contentPlan?.ctaStrategy?.trim() || null,
    formats: {
      text: {
        enabled: Boolean(draftTitle || draftBody),
        title: draftTitle,
        body: draftBody,
      },
      cardnews: {
        enabled: cardnewsEnabled,
        aspectRatio: cardnewsEnabled ? "4:5" : null,
        cards: cardnewsEnabled ? buildCardNewsCards(candidate) : [],
        brandingIntent: null,
      },
      shortform: {
        enabled: shortformEnabled,
        orientation: "vertical",
        targetDurationRange: null,
        narrationSegments: shortformEnabled && draftBody ? splitNarrationSegments(draftBody) : [],
        cta: candidate.contentPlan?.ctaStrategy?.trim() || null,
        voiceProfileId: null,
      },
    },
    provenance: {
      builtFrom: "completed-marketing-candidate",
      candidateContract: candidate.contract,
      assignmentId: candidate.contentAssignment.assignmentId,
      selectedAgendaId: candidate.selectedAgenda.id,
      governanceReviewId: candidate.provenance.governanceReviewId,
      evidenceRefIds: evidenceRefs.map((ref) => ref.evidenceId),
    },
  };

  return parseMediaBrief(brief);
}
