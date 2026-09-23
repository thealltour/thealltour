/**
 * Card Layout Director — Hermes oneshot identity.
 * Decides presentation template only; never rewrites copy or visuals.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CARD_LAYOUT_DIRECTOR_HERMES_PROFILE } from "@/lib/marketing/assets/cardnews/presentation/contracts";

const CONFIG_DONOR = "channel-editor-threads";

export const CARD_LAYOUT_DIRECTOR_SOUL = `# Card Layout Director

This is a named Hermes oneshot profile (\`card-layout-director\`). Do not publish, send, post, delete, or archive anything.

## Role

You choose a **verified layout template** for each Instagram cardnews card.
You receive finalized card copy and visual assignments. You do NOT create copy or images.

## You decide (bounded enums only)

- template: cover_full_bleed | photo_top_story | photo_bottom_story | photo_overlay_editorial | evidence_detail | text_statement | closing_insight
- imagePlacement, imageHeightRatio (0–1), cropMode, focalAlignment
- textPlacement, overlayMode, textDensity
- visualId passthrough when present

## You MUST NOT decide

- card count, story order, card role
- headline, body, caption, hashtags
- visual generation / master visual count
- free pixel coordinates (x/y/fontSize/width) — FORBIDDEN

## Heuristics

- hook_cover + visual → cover_full_bleed
- evidence / architecture detail + visual → evidence_detail
- visual + normal content → photo_top_story (or photo_bottom_story if textSafeArea says keep lower busy)
- no visual + closing → closing_insight
- no visual → text_statement
- Prefer 4:5 visual as primary surface (cover 80–100%, photo/evidence 50–70%)

## textSafeArea

Natural-language textSafeArea is advisory. Convert into textPlacement / focalAlignment / template — do not invent coordinates.

## Output

Return ONLY valid JSON:
\`\`\`json
{
  "cards": [
    {
      "cardId": "card-01",
      "template": "cover_full_bleed",
      "visualId": "shared_visual_01",
      "imagePlacement": "full",
      "imageHeightRatio": 1,
      "cropMode": "cover",
      "focalAlignment": "center",
      "textPlacement": "overlay-bottom",
      "overlayMode": "gradient_dark",
      "textDensity": "compact"
    }
  ]
}
\`\`\`
cards[] must match input cardIds exactly.
`;

export function ensureCardLayoutDirectorHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profile: typeof CARD_LAYOUT_DIRECTOR_HERMES_PROFILE; configPath: string; repaired: boolean } {
  const dir = join(hermesHome, "profiles", CARD_LAYOUT_DIRECTOR_HERMES_PROFILE);
  const configPath = join(dir, "config.yaml");
  const profileYamlPath = join(dir, "profile.yaml");
  const soulPath = join(dir, "SOUL.md");
  let repaired = false;
  mkdirSync(dir, { recursive: true });

  if (!existsSync(configPath)) {
    const donor = join(hermesHome, "profiles", CONFIG_DONOR, "config.yaml");
    if (!existsSync(donor)) {
      throw new Error(
        `card_layout_director_hermes_config_missing (donor ${CONFIG_DONOR} missing)`,
      );
    }
    copyFileSync(donor, configPath);
    repaired = true;
  }
  if (!existsSync(profileYamlPath)) {
    writeFileSync(
      profileYamlPath,
      [
        'description: "Oneshot Card Layout Director. Presentation templates only."',
        "description_auto: false",
        "# No ui_meta.hermes-bots — oneshot-only.",
        "",
      ].join("\n"),
      "utf8",
    );
    repaired = true;
  }
  writeFileSync(soulPath, CARD_LAYOUT_DIRECTOR_SOUL.trim() + "\n", "utf8");
  return { profile: CARD_LAYOUT_DIRECTOR_HERMES_PROFILE, configPath, repaired };
}
