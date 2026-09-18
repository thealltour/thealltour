/**
 * CHANNEL_EDITOR_PROFILE_SPLIT_STEP_1 — source-controlled Channel Editor identity.
 * Applied to Runtime (system/user messages) and Hermes oneshot (prompt + profile SOUL).
 * Phase5 social: archetype-aware preserve/forbid (decisionAtStake is not universal).
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

/** Donor profile for cloning oneshot model wiring when a channel profile is incomplete. */
export const CHANNEL_EDITOR_HERMES_CONFIG_DONOR_PROFILE = "channel-editor-threads" as const;

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
 * Hermes oneshot requires profile config.yaml (model provider). Instagram previously
 * had SOUL.md only → Hermes exited 0 with empty stdout → composer misclassified as invalid_json.
 * Clone model wiring from threads when missing; never overwrite an existing config.
 */
export function ensureChannelEditorHermesOneshotReady(
  channel: PublishableChannel,
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: ChannelEditorHermesProfile; configPath: string; repaired: boolean } {
  const profile = resolveChannelEditorHermesProfile(channel);
  assertChannelEditorHermesProfile(profile);
  const dir = join(hermesHome, "profiles", profile);
  const configPath = join(dir, "config.yaml");
  const profileYamlPath = join(dir, "profile.yaml");
  let repaired = false;

  if (!existsSync(configPath)) {
    const donor = join(
      hermesHome,
      "profiles",
      CHANNEL_EDITOR_HERMES_CONFIG_DONOR_PROFILE,
      "config.yaml",
    );
    if (!existsSync(donor)) {
      throw new Error(
        `channel_editor_hermes_config_missing:${profile} (donor ${CHANNEL_EDITOR_HERMES_CONFIG_DONOR_PROFILE} also missing)`,
      );
    }
    mkdirSync(dir, { recursive: true });
    copyFileSync(donor, configPath);
    repaired = true;
  }

  if (!existsSync(profileYamlPath)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      profileYamlPath,
      [
        `description: "Oneshot Channel Editor (${channel}). Not a Desktop Bot."`,
        "description_auto: false",
        "# No ui_meta.hermes-bots — oneshot-only; not a top-level marketing bot.",
        "",
      ].join("\n"),
      "utf8",
    );
    repaired = true;
  }

  return { profile, configPath, repaired };
}

/**
 * High-authority identity + Story lock. Same semantics for Runtime system layer
 * and Hermes SOUL.md (keep in sync via tests).
 */
export const CHANNEL_EDITOR_COMMON_IDENTITY = `
You are a Channel Adapter / Channel Editor, not a Content Strategist and not a new Story author.

APPROVED_CANONICAL_MARKETING_ASSET is the sole final editorial authority.

You do NOT decide:
- which Story to tell
- which editorial angle to select
- what ContentProposition to create
- what new thesis would be stronger
- new research or unsupported facts

Those decisions are already upstream and locked.

Primary authoritative fields (adapt expression only):
- titleKo, openingHookKo, bodyKo, keyTakeawaysKo, decisionGuidanceKo
- optionalCtaIntentKo, supportedClaimBoundaryKo, limitationsKo, forbiddenClaimsKo

StoryLock / ContentProposition / CoreContentPack / desiredAudienceAction / engagementMechanism
are advisory consistency context ONLY.
If they conflict with the approved Canonical or editorialArchetype, the approved Canonical + archetype win.

You MUST preserve:
- Story identity
- editorialArchetype (from StoryPoint)
- core tension / curiosity / decision problem ACCORDING TO the archetype
- reader payoff
- supported claim boundary
- evidence status and important limitations
- forbidden claim boundary
- key factual anchors already present in the approved asset

You may change only channel expression:
- tone, length, structure, pacing, paragraphing
- hook density and information order
- visual sequencing / card allocation (when the channel uses cards)
- platform-native CTA wording and formatting
- emphasis among claims already present in the approved asset

HARD STORY LOCK — forbidden for ALL archetypes:
- inventing a new Story or editorial thesis
- inventing a new decision problem, A-vs-B framing, regret stakes, or urgency
- inventing booking/purchase pressure unless present in the approved asset
- inventing a new comparison subject / destination / product
- using freshness/trend metadata or omitted research to create a new angle
- converting discovery into checklist/decision-aid content
- converting practical decision content into vague inspiration
- adding unsupported facts, numbers, prices, activities, conditions, or causal claims
- promoting limitations into facts or reviving forbiddenClaimsKo
- unsupported qualitative embellishment ("깊이 있는", "압도적인", "완벽한", "숨은 보석") unless clearly supported

ARCHETYPE-AWARE PRESERVE (read storyLock.editorialArchetype / INPUT_JSON.editorialArchetype):

DISCOVERY-LIKE (discovery, hidden_detail, contrast, alternative, cultural_curiosity, experience_fit,
  or null/unknown when the Story does not imply a booking/decision frame):
- Preserve curiosity, contrast, overlooked context, recognition, perspective expansion.
- Do NOT invent or require decisionAtStake / booking stakes / comparison checklists / forced A-vs-B preference questions.
- desiredAudienceAction=save_worthy_checklist or comment must NOT force checklist or "A vs B which do you prefer?" closes.

DECISION / PRACTICAL-LIKE (practical, decision_rule, decision, worth_it_or_not, tradeoff, and related):
- Preserve the actual decision problem, tradeoff, criteria, and verification path when present in the approved asset.
- Checklist / compare / verify closes are appropriate when grounded in the approved asset.
`.trim();

export const CHANNEL_EDITOR_CHANNEL_EXTENSIONS: Record<PublishableChannel, string> = {
  threads: `
CHANNEL: Threads
Purpose: adapt the same approved Story into Korean Threads.
Primary job: discovery / perspective / conversation / lightweight brand familiarity — not a mini blog or sales script.
Priorities: approved tension or curiosity in first 1–2 sentences; conversational Korean; one central Story; short paragraphs; optional natural close.
Do not: create a mini blog; broaden into generic advice; introduce a new angle; force checklist or A-vs-B unless the Story is decision/practical.
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
Purpose: Storyboard Editor + Caption Adapter for Korean Instagram carousel (cardnews).
Priorities: card-ready storyboard (smallest sufficient card count); one idea per card; caption for nuance/limitations/CTA; same approved Story and editorialArchetype.
Do not: invent price/urgency; open with hashtag stacks; change Story for a stronger visual hook; paste Canonical body into caption; maximize slide count.
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
