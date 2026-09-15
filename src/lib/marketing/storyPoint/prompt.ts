import {
  STORY_CANDIDATE_MAX,
  STORY_CANDIDATE_MIN,
  STORY_MECHANISMS,
  type StoryMechanism,
} from "@/lib/marketing/storyPoint/contracts";

export type StoryMinerPromptInput = {
  agendaTitle: string;
  agendaSummary: string;
  agendaRationale: string[];
  commercialIntent: string;
  destinations: string[];
  topics: string[];
  assignmentObjective: string;
  assignmentTopic: string;
  evidenceSnippets: string[];
  topicIdentitySummary: string;
  recentTitles: string[];
  recentStorySummaries: string[];
  lightResearchHints: string[];
  /** Prior attempt diagnostics for remine. */
  retryContext?: {
    attempt: number;
    priorFailureReasons: string[];
    repeatedMechanisms: string[];
    excludedHypotheses: string[];
    nonGoals: string[];
    neededNewCount: number;
  } | null;
};

const MECHANISM_LIST = STORY_MECHANISMS.join(", ");

/**
 * Editorial ideation only — not channel copy, not research, not tip lists.
 */
export function buildStoryMinerPrompt(input: StoryMinerPromptInput): string {
  const retry = input.retryContext;
  const lines: string[] = [
    "You are the Editorial Story/Point Miner (TypeScript staff). You do NOT write social posts.",
    "You do NOT research the web. You do NOT give travel tips.",
    "Ask: What editorial story is worth investigating for this agenda?",
    "Generate editorial hypotheses with tension, curiosity gap, and reader payoff.",
    "",
    "HARD RULES:",
    `- Return JSON only: { "candidates": [ ... ] } with ${STORY_CANDIDATE_MIN}-${STORY_CANDIDATE_MAX} candidates.`,
    "- Fewer than 5 candidates is a failed generation.",
    "- Each candidate MUST include: storyQuestion OR storyClaim, whyInteresting, audienceTension,",
    "  curiosityGap, readerPayoff, researchNeeded[], researchQuestions[], genericRisk,",
    "  mechanisms (1-2 from allowed list), channelPotential, nonGoals[].",
    `- Allowed mechanisms: ${MECHANISM_LIST}`,
    "- Prefer mechanism variety across the set. Do not emit 5 paraphrases of one checklist idea.",
    "- researchNeeded = investigation scope. researchQuestions = falsifiable verification questions.",
    "- Discourage: generic prep guides, broad destination summaries, checklist packaging,",
    "  destination recommendation lists, obvious advice without tension/gap.",
    "- Stay locked to the agenda topic identity (destination / product / travel mode / commercial subject).",
    "- Do not invent cruise/hotel/flight subjects unsupported by identity.",
    "",
    "AGENDA:",
    `title: ${input.agendaTitle}`,
    `summary: ${input.agendaSummary}`,
    `rationale: ${input.agendaRationale.slice(0, 4).join(" | ") || "(none)"}`,
    `commercialIntent: ${input.commercialIntent}`,
    `destinations: ${input.destinations.join(", ") || "(none)"}`,
    `topics: ${input.topics.join(", ") || "(none)"}`,
    `assignmentObjective: ${input.assignmentObjective}`,
    `assignmentTopic: ${input.assignmentTopic}`,
    `topicIdentity: ${input.topicIdentitySummary}`,
    "",
    "EVIDENCE SNIPPETS (bounded):",
    ...(input.evidenceSnippets.slice(0, 6).map((s, i) => `${i + 1}. ${s}`) || ["(none)"]),
    "",
    "RECENT CONTENT (avoid repetition; do not override agenda):",
    ...(input.recentTitles.slice(0, 8).map((t) => `- title: ${t}`) || ["(none)"]),
    ...(input.recentStorySummaries.slice(0, 5).map((t) => `- story: ${t}`) || []),
    "",
    "LIGHT RESEARCH / TREND HINTS (already available; no new search):",
    ...(input.lightResearchHints.slice(0, 6).map((h) => `- ${h}`) || ["(none)"]),
  ];

  if (retry) {
    lines.push(
      "",
      `RETRY attempt ${retry.attempt}: explore DIFFERENT editorial hypotheses.`,
      `Need about ${retry.neededNewCount} NEW candidates that are not paraphrases of prior ideas.`,
      `Prior gate/diversity failure reasons: ${retry.priorFailureReasons.join("; ") || "(none)"}`,
      `Repeated mechanisms to reduce: ${retry.repeatedMechanisms.join(", ") || "(none)"}`,
      `Excluded hypotheses:`,
      ...retry.excludedHypotheses.slice(0, 12).map((h) => `- ${h}`),
      `nonGoals to respect: ${retry.nonGoals.slice(0, 8).join(" | ") || "(none)"}`,
      "Do not simply 'try again' with reworded checklists.",
    );
  }

  lines.push(
    "",
    "channelPotential object keys: conversation, visualExplainability, searchDepth, shortformHookability",
    "Each level: high | medium | low",
    "JSON only. No markdown. No channel copy.",
  );

  return lines.join("\n");
}

export function summarizeMechanisms(mechanisms: StoryMechanism[]): string {
  return mechanisms.join("+");
}
