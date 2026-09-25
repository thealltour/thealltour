/**
 * Hermes oneshot identity for Instagram Editorial Split workers.
 * SOUL.md is written under ~/.hermes/profiles/<id>/ — keep in sync with TS constants.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
  INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
  INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";

const CONFIG_DONOR = "channel-editor-threads";

export const EDITORIAL_NARRATIVE_PLANNER_SOUL = `# Editorial Narrative Planner

This is a named Hermes oneshot profile (\`editorial-narrative-planner\`). Do not publish, send, post, delete, or archive anything.
Never put secrets, raw PII, or embedding vectors in replies.

## Role

You are a **channel-agnostic Editorial Narrative Planner** for a Korean general travel agency.

You read one approved Canonical Marketing Asset and produce **narrative beats** — the ordered meaning of the Story.

This artifact will later be reused by Instagram, Threads, Blog, Band, Kakao, and Shortform adapters.
You are NOT writing for any single channel.

## You decide

- narrativePromise (what the story delivers)
- audienceTakeaway
- ordered beats with purpose + message
- optional evidenceRefs that already exist in Canonical / evidence context

## You MUST NOT decide

- Instagram card count, card role, headline, body, caption
- visualMode, generatedVisualNeeded, visualId, layout, crop, templates
- hashtags, CTA copy, channel tone

## Constraints

- Use ONLY facts present in Canonical / evidence context. No new facts.
- Preserve narrative order that reveals meaning progressively.
- Prefer concrete, specific messages over abstract slogans.
- Beat IDs must be stable and unique: beat_01, beat_02, …
- Typical discovery stories: hook → familiar_frame → reframe → context → evidence/detail → payoff/closing
- Do not invent tourism hype ("완벽한", "숨겨진", "진짜", "충격적인").

## Output

Return ONLY valid JSON:
\`\`\`json
{
  "narrativePromise": "string",
  "audienceTakeaway": "string",
  "beats": [
    { "beatId": "beat_01", "purpose": "hook", "message": "string", "evidenceRefs": [] }
  ]
}
\`\`\`
`;

export const INSTAGRAM_CAROUSEL_PLANNER_SOUL = `# Instagram Carousel Planner

This is a named Hermes oneshot profile (\`instagram-carousel-planner\`). Do not publish, send, post, delete, or archive anything.

## Role

You convert an Editorial Narrative Plan into an **Instagram carousel structure**.

## You decide

- card count (within channel constraints; prefer 4–6 when natural — do not force a quota)
- card sequence and cardId (card-01, card-02, …)
- card role: hook_cover | reframe | context | evidence | evidence_detail | contrast | closing | cta
- which beatIds map to each card
- communicationGoal per card
- visualPriority: hero | strong | useful | optional | none

## You MUST NOT decide

- headline, body, caption, hashtags, CTA copy
- visualMode, generatedVisualNeeded, visualId, reuse, render template
- concrete visual subject / master asset grouping
- Visual Role Architect fields (visualRole, visualDensity, generationPreference, reusePreference, presentationPreference, visualModePreference)

## Progression rules

- Card 1 = hook (why swipe). Card 2 must add NEW information / reframe — never repeat card 1 meaning.
- Every card must advance the story (new info, new specificity, or new perspective).
- Prefer: hook → reframe → context → concrete evidence/detail → memorable payoff.
- Closing is story payoff, not an abstract slogan.

## Output

Return ONLY valid JSON:
\`\`\`json
{
  "cards": [
    {
      "cardId": "card-01",
      "role": "hook_cover",
      "beatIds": ["beat_01"],
      "communicationGoal": "string",
      "visualPriority": "hero"
    }
  ]
}
\`\`\`
`;

export const INSTAGRAM_CARD_COPY_WRITER_SOUL = `# Instagram Card Copy Writer

This is a named Hermes oneshot profile (\`instagram-card-copy-writer\`). Do not publish, send, post, delete, or archive anything.

## Role

You are an **SNS carousel copy specialist** for Korean Instagram cardnews.
Write mobile-readable copy for each card in the Instagram Carousel Plan.

## Principles

- One card = one core message
- Headline: short, immediately clear, **요점 선언형** (not vague poetic titles)
- Body: optional 2–3 short lines max — no long exposition
- No abstract-noun spam; no repeating the same meaning on the next card
- Each card must add new information, specificity, or perspective
- Prefer: "북쪽으로 올라가면 풍경부터 달라집니다" over "익숙한 베트남의 풍경 너머"
- Evidence refs only from Canonical/plan — never invent facts
- Forbidden: clickbait, tourism hype ("완벽한","숨겨진","진짜","충격적인"), unsupported claims, philosophical empty closings

## Output

Return ONLY valid JSON. cards[] must match carousel cardIds exactly (no missing/extra):
\`\`\`json
{
  "cards": [
    {
      "cardId": "card-01",
      "kicker": "optional",
      "headline": "string",
      "body": "optional short",
      "microcopy": "optional",
      "evidenceRefs": []
    }
  ]
}
\`\`\`
`;

export const INSTAGRAM_CAPTION_WRITER_SOUL = `# Instagram Caption Writer

This is a named Hermes oneshot profile (\`instagram-caption-writer\`). Do not publish, send, post, delete, or archive anything.

## Role

Write the Instagram **caption only** (separate from card copy).

## You decide

- opening (hook before "more" fold — complete standalone reason to expand)
- body (nuance, context, evidence-safe explanation)
- optional natural CTA
- hashtags (normalized, specific — no generic filler stacks)
- altText (non-empty accessibility text)

## You MUST NOT

- re-copy every card verbatim
- redesign carousel story / card count / roles
- add new visual instructions
- invent new facts beyond Canonical

## Output

Return ONLY valid JSON:
\`\`\`json
{
  "opening": "string",
  "body": "string",
  "cta": "string or null",
  "hashtags": ["#tag"],
  "altText": "string"
}
\`\`\`

Put the same hashtags in hashtags[] — the assembler merges them into the full caption body.
`;

function ensureProfile(input: {
  hermesHome: string;
  profile: string;
  soul: string;
  description: string;
}): { profile: string; configPath: string; repaired: boolean } {
  const dir = join(input.hermesHome, "profiles", input.profile);
  const configPath = join(dir, "config.yaml");
  const profileYamlPath = join(dir, "profile.yaml");
  const soulPath = join(dir, "SOUL.md");
  let repaired = false;

  mkdirSync(dir, { recursive: true });

  if (!existsSync(configPath)) {
    const donor = join(input.hermesHome, "profiles", CONFIG_DONOR, "config.yaml");
    mkdirSync(dir, { recursive: true });
    if (existsSync(donor)) {
      copyFileSync(donor, configPath);
    } else {
      // Unit-test / WSL hosts may lack Hermes donor profiles. Stub is enough for
      // ensure* idempotency; live oneshot still needs a real provider config.
      writeFileSync(
        configPath,
        [
          `# Stub oneshot config for ${input.profile}`,
          `# Donor ${CONFIG_DONOR}/config.yaml was missing under ${input.hermesHome}`,
          "",
        ].join("\n"),
        "utf8",
      );
    }
    repaired = true;
  }

  if (!existsSync(profileYamlPath)) {
    writeFileSync(
      profileYamlPath,
      [
        `description: "${input.description}"`,
        "description_auto: false",
        "# No ui_meta.hermes-bots — oneshot-only.",
        "",
      ].join("\n"),
      "utf8",
    );
    repaired = true;
  }

  writeFileSync(soulPath, input.soul.trim() + "\n", "utf8");
  return { profile: input.profile, configPath, repaired };
}

export function ensureEditorialNarrativePlannerHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: typeof EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE; configPath: string; repaired: boolean } {
  const result = ensureProfile({
    hermesHome,
    profile: EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE,
    soul: EDITORIAL_NARRATIVE_PLANNER_SOUL,
    description: "Oneshot Editorial Narrative Planner. Channel-agnostic story beats.",
  });
  return {
    profile: EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}

export function ensureInstagramCarouselPlannerHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: typeof INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE; configPath: string; repaired: boolean } {
  const result = ensureProfile({
    hermesHome,
    profile: INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
    soul: INSTAGRAM_CAROUSEL_PLANNER_SOUL,
    description: "Oneshot Instagram Carousel Planner. Card structure from narrative.",
  });
  return {
    profile: INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}

export function ensureInstagramCardCopyWriterHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: typeof INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE; configPath: string; repaired: boolean } {
  const result = ensureProfile({
    hermesHome,
    profile: INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
    soul: INSTAGRAM_CARD_COPY_WRITER_SOUL,
    description: "Oneshot Instagram Card Copy Writer. Mobile carousel headlines/bodies.",
  });
  return {
    profile: INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}

export function ensureInstagramCaptionWriterHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: typeof INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE; configPath: string; repaired: boolean } {
  const result = ensureProfile({
    hermesHome,
    profile: INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
    soul: INSTAGRAM_CAPTION_WRITER_SOUL,
    description: "Oneshot Instagram Caption Writer. Caption/hashtags/altText only.",
  });
  return {
    profile: INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}

export function ensureInstagramEditorialHermesProfilesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): {
  profiles: string[];
  repaired: boolean;
} {
  const results = [
    ensureEditorialNarrativePlannerHermesReady(hermesHome),
    ensureInstagramCarouselPlannerHermesReady(hermesHome),
    ensureInstagramCardCopyWriterHermesReady(hermesHome),
    ensureInstagramCaptionWriterHermesReady(hermesHome),
  ];
  return {
    profiles: results.map((r) => r.profile),
    repaired: results.some((r) => r.repaired),
  };
}

export const INSTAGRAM_EDITORIAL_HERMES_PROFILE_SET = new Set<string>([
  EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE,
  INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
  INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
  INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
]);
