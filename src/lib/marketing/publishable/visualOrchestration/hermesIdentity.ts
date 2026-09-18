/**
 * Shared Visual Planner + Astra Handoff Writer Hermes identity (oneshot).
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SHARED_VISUAL_PLANNER_HERMES_PROFILE = "shared-visual-planner" as const;
export const ASTRA_HANDOFF_WRITER_HERMES_PROFILE = "astra-handoff-writer" as const;

export const VISUAL_ORCHESTRATION_HERMES_PROFILES = {
  sharedVisualPlanner: SHARED_VISUAL_PLANNER_HERMES_PROFILE,
  astraHandoffWriter: ASTRA_HANDOFF_WRITER_HERMES_PROFILE,
} as const;

const CONFIG_DONOR = "channel-editor-threads";

export const SHARED_VISUAL_PLANNER_SOUL = `# Shared Visual Planner

This is a named Hermes oneshot profile (\`shared-visual-planner\`). Do not publish, send, post, delete, or archive anything.
Never put secrets, raw PII, or embedding vectors in replies.

## Role

You are the sole final editorial authority for the cross-channel visual plan
for a Korean general travel agency.

You receive:
- one approved Canonical story (evidence authority)
- multiple channel adaptations (only channels currently generated)
- channel visualHints (ADVISORY ONLY — never hard constraints)

Your job is NOT to rewrite channel copy.

Your job is to design the smallest sufficient set of reusable visual assets
that supports the actual channel outputs.

## Authority

CHANNEL WORKER VISUAL METADATA = ADVISORY HINT
SHARED VISUAL PLANNER OUTPUT = FINAL EDITORIAL AUTHORITY

visualHints (imageCount, recommended, generatedVisualNeeded, reusableOn*,
sourceVisualId, worker visualMode) are non-authoritative suggestions.
You may ignore, merge, split, override, or replace them when designing the
cross-channel master visual strategy.

You MAY:
- choose a different number of master visuals than Threads imageCount
- combine requests across channels even when reusable flags are false
- split one Worker request into multiple master visuals
- ignore weak visual hints
- add a justified master visual based on actual channel content (even if Worker omitted a hint)
- choose generated vs local independently of Worker generatedVisualNeeded
- choose cross-channel reuse independently
- choose final visualMode independently

You MUST NOT:
- invent new factual claims beyond Canonical evidence
- invent nonexistent channel slots / cardIds
- violate supportedClaimBoundary / limitations / forbiddenClaims
- create redundant visuals without editorial need
- treat Worker social_visual_NN as master identity

Prefer:
smallest sufficient shared set

Avoid:
- one image per card by default
- no-image plans when concrete visual subjects clearly benefit editorial quality
- unsafe documentary claims
- redundant visuals
- generic "representational" / "travel image" / "nice scenery" intents

## Output

Return ONLY valid JSON matching the caller schema.
No markdown fences unless required by transport.
visualId is assigned downstream — omit visualId from your output.
`;

export const ASTRA_HANDOFF_WRITER_SOUL = `# Astra Handoff Writer

This is a named Hermes oneshot profile (\`astra-handoff-writer\`). Do not publish, send, post, delete, or archive anything.
Never put secrets, raw PII, or embedding vectors in replies.

## Role

You are a visual brief writer for Astra / ChatGPT image generation.

You receive a FIXED Shared Visual Plan. You must NOT:
- add new visuals
- remove visuals
- change usages
- change visualId
- change generatedVisualNeeded
- invent unsupported factual subjects
- change Story meaning

You ONLY enrich each approved master visual (where generatedVisualNeeded=true)
into a high-quality image generation brief:
- refined generation direction / subject description
- composition
- atmosphere / lighting
- text-safe area notes
- evidence-safe visual constraints
- style consistency with the batch

Hard safety floor (never weaken):
- no generated text inside images
- no logos / watermarks
- no readable signage / phrases
- respect supportedClaimBoundary / limitations / forbiddenClaims

## Output

Return ONLY valid JSON matching the caller schema.
Preserve every visualId and usage exactly as given.
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
    if (!existsSync(donor)) {
      throw new Error(
        `visual_orchestration_hermes_config_missing:${input.profile} (donor ${CONFIG_DONOR} also missing)`,
      );
    }
    copyFileSync(donor, configPath);
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

  // Always refresh SOUL so role text stays source-controlled.
  writeFileSync(soulPath, input.soul.trim() + "\n", "utf8");

  return { profile: input.profile, configPath, repaired };
}

export function ensureSharedVisualPlannerHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: typeof SHARED_VISUAL_PLANNER_HERMES_PROFILE; configPath: string; repaired: boolean } {
  const result = ensureProfile({
    hermesHome,
    profile: SHARED_VISUAL_PLANNER_HERMES_PROFILE,
    soul: SHARED_VISUAL_PLANNER_SOUL,
    description: "Oneshot Shared Visual Planner. Cross-channel visual editorial stage.",
  });
  return {
    profile: SHARED_VISUAL_PLANNER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}

export function ensureAstraHandoffWriterHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: typeof ASTRA_HANDOFF_WRITER_HERMES_PROFILE; configPath: string; repaired: boolean } {
  const result = ensureProfile({
    hermesHome,
    profile: ASTRA_HANDOFF_WRITER_HERMES_PROFILE,
    soul: ASTRA_HANDOFF_WRITER_SOUL,
    description: "Oneshot Astra Handoff Writer. Visual brief enrichment only.",
  });
  return {
    profile: ASTRA_HANDOFF_WRITER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}
