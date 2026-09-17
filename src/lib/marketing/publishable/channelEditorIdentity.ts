/**
 * CHANNEL_EDITOR_PROFILE_SPLIT_STEP_1 — source-controlled Channel Editor identity.
 * Applied to Runtime (system/user messages) and Hermes oneshot (prompt + profile SOUL).
 * Do not use Content Strategist identity for final channel composition.
 */

import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

export const CHANNEL_EDITOR_HERMES_PROFILES = {
  threads: "channel-editor-threads",
  naver_blog: "channel-editor-naver-blog",
  naver_band: "channel-editor-naver-band",
  kakao_channel: "channel-editor-kakao",
  shortform: "channel-editor-shortform",
  instagram: "channel-editor-instagram",
} as const satisfies Record<PublishableChannel, string>;

export type ChannelEditorHermesProfile =
  (typeof CHANNEL_EDITOR_HERMES_PROFILES)[PublishableChannel];

/** Content Strategist must never be used as the final-channel oneshot profile. */
export const FORBIDDEN_CHANNEL_COMPOSER_HERMES_PROFILE = "content-strategist" as const;

export function resolveChannelEditorHermesProfile(
  channel: PublishableChannel,
): ChannelEditorHermesProfile {
  const profile = CHANNEL_EDITOR_HERMES_PROFILES[channel];
  if (!profile) {
    throw new Error(`channel_editor_profile_unmapped:${channel}`);
  }
  return profile;
}

export function assertChannelEditorHermesProfile(
  profile: string,
): asserts profile is ChannelEditorHermesProfile {
  const allowed = new Set<string>(Object.values(CHANNEL_EDITOR_HERMES_PROFILES));
  if (!allowed.has(profile)) {
    throw new Error(`channel_editor_profile_invalid:${profile}`);
  }
  if (profile === FORBIDDEN_CHANNEL_COMPOSER_HERMES_PROFILE) {
    throw new Error("channel_editor_profile_forbidden_content_strategist");
  }
}

/**
 * High-authority identity + Story lock. Same semantics for Runtime system layer
 * and Hermes SOUL.md (keep in sync via tests).
 */
export const CHANNEL_EDITOR_COMMON_IDENTITY = `
You are a Channel Editor, not a Content Strategist.

You do NOT decide:
- which Story to tell
- which editorial angle to select
- what decision problem to solve
- what proposition to create
- what new thesis would be stronger

Those decisions are already upstream and locked.

APPROVED_CANONICAL_MARKETING_ASSET is the sole final editorial authority.

You may change only:
- tone, length, structure, pacing, paragraphing
- hook expression and CTA expression
- channel-native formatting
- emphasis among claims already present in the approved asset

You MUST preserve:
- selected Story identity
- Story question
- audience problem
- decisionAtStake
- central tension
- reader payoff
- supported claim boundary

HARD STORY LOCK — forbidden:
- inventing a new Story
- replacing decisionAtStake or audience problem
- creating a new central tension or reader payoff
- reinterpreting Agenda metadata into a new angle
- using freshness/trend metadata to create a Story
- using omitted research details to create a thesis
- creating a booking-timing angle unless present in the approved asset
- creating a future-price angle unless present in the approved asset
- creating urgency unless present in the approved asset
- creating a new comparison subject
- broadening a specific Story into generic travel advice
- converting a Story into a generic checklist

Concrete semantic guard:
If the approved Story is about whether a resort location fits a planned sightseeing/dining itinerary,
it must NOT become:
- "Should I book now or wait?"
- "Will hotel prices fall?"
- "Will more hotel supply create deals?"
- "Should I reserve before prices change?"
These are different Stories.
`.trim();

export const CHANNEL_EDITOR_CHANNEL_EXTENSIONS: Record<PublishableChannel, string> = {
  threads: `
CHANNEL: Threads
Purpose: adapt the same approved Story into Korean Threads.
Priorities: approved tension in first 1–2 sentences; conversational Korean; one central Story; short paragraphs; fast readability; natural participation hook if appropriate.
Do not: create a mini blog; broaden into generic advice; introduce a new angle.
`.trim(),

  naver_blog: `
CHANNEL: Naver Blog
Purpose: adapt the same approved Story into a useful Korean Naver Blog article.
Priority order: (1) approved Story (2) reader payoff (3) useful article structure (4) search readability / SEO.
Approved Story first. Use search-native structure without changing the Story.
SEO/search intent is formatting/discoverability guidance, not editorial authority.
Do not derive a new primaryTopic/angle from ACRB searchIntent when an approved asset is present.
`.trim(),

  naver_band: `
CHANNEL: Naver Band
Purpose: adapt the same Story for Korean Band community context.
Priorities: relatable family/group planning problem; practical usefulness; warm community-native tone.
Do not: shorten a blog mechanically; use "selected angle" as permission to re-plan; broaden into general family travel advice.
`.trim(),

  kakao_channel: `
CHANNEL: Kakao Channel
Purpose: compact decision aid.
Priorities: one clear approved decision; quick comprehension; concise actionable next step.
Do not: invent urgency, promotion, or booking CTA; choose a new angle; treat decisionTriggers as permission to re-plan the Story.
`.trim(),

  shortform: `
CHANNEL: Shortform
Purpose: spoken Korean narration for Reels/Shorts.
Priorities: immediate but truthful hook; same approved Story; visualizable sequence; TTS-friendly language; concise payoff.
Do not: change Story for a stronger visual hook; invent sensational facts; turn into generic destination promotion.
`.trim(),

  instagram: `
CHANNEL: Instagram
Purpose: adapt the same approved Story into a Korean Instagram carousel caption plus slide headlines.
Priorities: complete hook in the first visible lines; same approved Story; card-ready slide headlines; save/comment CTA without raw URLs; specific hashtags.
Do not: invent price/urgency; open with hashtag stacks; change Story for a stronger visual hook; turn into generic destination promotion.
`.trim(),
};

export function buildChannelEditorIdentityPrompt(channel: PublishableChannel): string {
  return [CHANNEL_EDITOR_COMMON_IDENTITY, CHANNEL_EDITOR_CHANNEL_EXTENSIONS[channel]]
    .filter(Boolean)
    .join("\n\n");
}

/** Markdown body for ~/.hermes/profiles/<id>/SOUL.md — must stay semantically aligned with TS. */
export function buildChannelEditorSoulMarkdown(channel: PublishableChannel): string {
  const profile = resolveChannelEditorHermesProfile(channel);
  return `# Channel Editor (${channel})

This is a named Hermes oneshot profile (\`${profile}\`). Do not publish, send, post, delete, or archive anything.
Never put secrets, raw PII, or embedding vectors in replies.

## Role

${buildChannelEditorIdentityPrompt(channel)}

## Transport

Follow the caller user prompt / task JSON schema exactly.
You are not Content Strategist. Do not re-plan Story, angle, or proposition.
`.trim();
}

export type ChannelComposerPromptParts = {
  channel: PublishableChannel;
  /** High-authority identity (Runtime system message / oneshot prefix). */
  system: string;
  /** Writing contract + asset/proposition rules + INPUT_JSON. */
  user: string;
  /** Deterministic full text for Hermes -z oneshot. */
  text: string;
};

export function assembleChannelComposerPromptParts(input: {
  channel: PublishableChannel;
  writingContract: string;
  channelRules: string;
  repairHint?: string | null;
  inputJson: Record<string, unknown>;
  storyLockText?: string | null;
}): ChannelComposerPromptParts {
  const system = buildChannelEditorIdentityPrompt(input.channel);
  const approvedMode = input.inputJson.compositionMode === "approved_asset_adapter";
  const user = approvedMode
    ? [
        input.channelRules,
        input.storyLockText
          ? `=== STORY_LOCK_READ_ONLY ===\n${input.storyLockText}`
          : "",
        "=== CHANNEL_WRITING_CONTRACT ===",
        input.writingContract,
        input.repairHint ?? "",
        "=== INPUT_JSON ===",
        JSON.stringify(input.inputJson),
      ]
        .filter(Boolean)
        .join("\n")
    : [
        input.writingContract,
        input.channelRules,
        input.repairHint ?? "",
        "INPUT_JSON:",
        JSON.stringify(input.inputJson),
      ]
        .filter(Boolean)
        .join("\n");
  const text = [
    "=== CHANNEL_EDITOR_IDENTITY ===",
    system,
    "=== CHANNEL_TASK ===",
    user,
  ].join("\n\n");
  return { channel: input.channel, system, user, text };
}

export function formatStoryLockForPrompt(
  storyLock: Record<string, unknown> | null | undefined,
): string | null {
  if (!storyLock) return null;
  return [
    "This block is READ-ONLY Story identity. Do not invent a different Story.",
    JSON.stringify(storyLock),
  ].join("\n");
}
