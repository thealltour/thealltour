/**
 * External Editorial Director contract — provider-agnostic.
 * Manual ChatGPT paste is one provenance; future OpenAI API / other LLMs reuse the same shape.
 */

import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

export const EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT = "external-editorial-director-v1" as const;
export const AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT = "agenda-slate-editorial-export-v1" as const;

export const EXTERNAL_STORY_SOURCE = "external_editorial_director" as const;
export const EXTERNAL_STORY_PROVIDER_CHATGPT_MANUAL = "chatgpt_manual" as const;

export const EDITORIAL_ARCHETYPES = [
  "worth_it_or_not",
  "who_is_it_for",
  "who_should_avoid",
  "hidden_cost",
  "expectation_vs_reality",
  "better_alternative",
  "decision_rule",
  "common_mistake",
  "tradeoff",
  "myth_busting",
  "before_you_book",
  "premium_or_overpriced",
  "convenience_vs_experience",
  "family_fit",
  "parent_travel_fit",
  "couple_fit",
] as const;
export type EditorialArchetype = (typeof EDITORIAL_ARCHETYPES)[number];

export type ExternalChannelPotentialScores = {
  threads: number | null;
  naverBlog: number | null;
  naverBand: number | null;
  kakaoChannel: number | null;
  shortform: number | null;
};

export type ExternalAgendaEvaluation = {
  agendaId: string;
  overallRank: number | null;
  marketingPotential: number | null;
  koreanAudienceRelevance: number | null;
  decisionUtility: number | null;
  storyExpandability: number | null;
  researchability: number | null;
  businessRelevance: number | null;
  channelPotential: ExternalChannelPotentialScores;
  reasonKo: string | null;
  weaknessKo: string | null;
};

export type ExternalSelectedAgenda = {
  agendaId: string | null;
  rank: number | null;
  reasonKo: string | null;
  /** When ChatGPT judges no agenda is strong enough. */
  noneStrongEnough?: boolean;
};

export type ExternalStoryCandidate = {
  externalStoryId: string;
  storyTitleKo: string | null;
  storyQuestionKo: string | null;
  storyClaimKo: string | null;
  audienceProblemKo: string | null;
  decisionAtStakeKo: string | null;
  stakes: string[];
  whyKoreanTravelerCaresKo: string | null;
  whyInterestingKo: string;
  audienceTensionKo: string;
  curiosityGapKo: string;
  readerPayoffKo: string;
  editorialArchetype: string | null;
  researchNeededKo: string[];
  researchQuestionsKo: string[];
  recommendedChannels: PublishableChannel[];
  channelReasonKo: string | null;
  riskKo: string;
  nonGoalsKo: string[];
};

export type ExternalEditorialDirectorPayload = {
  contract: typeof EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT;
  agendaEvaluation: ExternalAgendaEvaluation[];
  selectedAgenda: ExternalSelectedAgenda;
  storyCandidates: ExternalStoryCandidate[];
};

export type ExternalStoryProvenance = {
  source: typeof EXTERNAL_STORY_SOURCE;
  provider: string;
  importedAt: string;
  agendaId: string;
  importContractVersion: typeof EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT;
  externalStoryId: string;
  editorialArchetype: string | null;
  storyTitleKo: string | null;
  importId: string;
};

/** Production-request metadata key: pointId → provenance. */
export const PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY = "externalStoryProvenance" as const;
/** Append-only import audit log on production request metadata. */
export const PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY = "externalEditorialImports" as const;

export type ExternalEditorialImportRecord = {
  importId: string;
  importedAt: string;
  provider: string;
  agendaId: string;
  importContractVersion: typeof EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT;
  addedPointIds: string[];
  skippedDuplicatePointIds: string[];
  rejected: Array<{ externalStoryId: string; reasons: string[] }>;
  selectedAgendaReasonKo: string | null;
  agendaEvaluation: ExternalAgendaEvaluation[];
};
