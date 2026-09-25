/**
 * Planner vocabulary boundary — internal planning language ≠ consumer surface wording.
 *
 * Narrative / Carousel may use structural terms (frame, reframe, payoff, context, rhythm)
 * for planning. Those fields are semantic instructions for downstream writers, not
 * lexical seeds to paste into headlines/bodies.
 *
 * Not a blacklist: abstract planner terms remain allowed inside planner artifacts.
 */

/** Critical prompt invariants — asserted in tests / SOUL parity. */
export const PLANNER_VOCABULARY_BOUNDARY_INVARIANTS = {
  title: "VOCABULARY BOUNDARY (internal ≠ surface)",
  notSurfaceCopy:
    "Your wording is semantic instruction for downstream writers — NOT consumer-facing copy and NOT a lexical seed to preserve verbatim.",
  downstreamMustRewrite:
    "Downstream channel writers must preserve meaning/intent but rewrite into natural consumer Korean; they must not treat narrativePromise, beat.message, or communicationGoal as ready-made surface phrases.",
  doNotPretendConsumer:
    "Do not write as if you are authoring the final reader-facing sentences. Prefer concise planning language that states what meaning this beat/card must deliver.",
  noBlacklist:
    "Internal terms (frame / rhythm / payoff / context / reframe / lens) remain allowed for structure. This is not a banned-word list.",
  highRiskFields:
    "High-risk lexical-anchor fields: narrativePromise, payoff/closing beat.message, carousel communicationGoal.",
} as const;

export const PLANNER_VOCABULARY_BOUNDARY_SEMANTIC_NOTES = [
  "VOCABULARY BOUNDARY: planner fields (narrativePromise, beat.message, communicationGoal) are semantic instructions, not consumer surface wording or lexical copy seeds.",
  "Downstream writers preserve meaning but rewrite into natural consumer Korean — do not require verbatim preservation of planner phrasing.",
  "Internal structure terms (frame/reframe/payoff/context/rhythm) are allowed for planning; this is not a blacklist.",
] as const;

/**
 * Downstream Card Copy Writer — how to read planner fields.
 * Reuses the same boundary; phrasing is writer-facing (not planner-facing).
 */
export const CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY = {
  title: "UPSTREAM PLANNER VOCABULARY BOUNDARY",
  semanticNotPhrasing:
    "Upstream planner wording is semantic instruction, not phrasing to preserve.",
  rewriteMeaning: "Rewrite the meaning into natural consumer-facing Korean.",
  fieldsNotSeeds:
    "narrativePromise, beat.message, and communicationGoal are SEMANTIC INTENT ONLY / NOT SURFACE WORDING — not preferred phrasing and not copy seeds.",
  preserveMeaningNotForm: "Preserve intended meaning, not lexical form.",
  plannerNotPreferred:
    "Do not treat planner wording as preferred phrasing. Re-express the job of each card in natural Korean cardnews voice.",
} as const;
