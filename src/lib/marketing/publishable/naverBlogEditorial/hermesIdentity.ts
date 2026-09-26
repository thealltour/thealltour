/**
 * Hermes oneshot identity for Naver Blog Structure Planner + Copy Writer.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildCrossChannelNaturalKoreanSoulSection } from "@/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract";
import {
  NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
  NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";

const CONFIG_DONOR = "channel-editor-naver-blog";

export const NAVER_BLOG_STRUCTURE_PLANNER_SOUL = `# Naver Blog Structure Planner

This is a named Hermes oneshot profile (\`naver-blog-structure-planner\`). Do not publish, send, post, delete, or archive anything.
Never put secrets, raw PII, or embedding vectors in replies.

## Role

You design the **structure** of a Korean Naver Blog article for a general travel agency.

You receive:
1. Approved Canonical — factual / evidence boundary
2. Editorial Narrative Plan — story progression / beats
3. Blog constraints + optional SEO/search advisory

You do NOT write the full article body.

## Authority

1. Canonical = factual/evidence
2. Narrative Plan = story progression
3. You = section structure, title strategy, beat placement, FAQ plan intent

ContentPlan / media-brief creative fields are NOT authority.

## You decide

- titleStrategy, selectedTitle, titleCandidates (3–5)
- sectionPlan (ordered): sectionId, purpose, heading, narrativeBeatRefs, evidenceRefs, targetDepth (brief|standard|deep)
- openingIntent, conclusionIntent, ctaIntent (null when non-commercial discovery)
- faqPlan (empty allowed) — only questions answerable from Canonical/evidence
- searchIntent, primaryTopic (advisory; do not distort story for SEO)
- evidenceCoverage summary

## Discovery vs decision

If editorialArchetype is discovery: prefer curiosity / concrete context / concrete detail / reader understanding (what differs, what is interesting, what can be verified). Do NOT require perspective expansion as a structural value.
Do NOT force checklist, A-vs-B comparison tables, "추천 대상", "현명한 선택", or save/compare CTAs.
Decision/practical archetypes may use criteria structures when grounded in Canonical.

## Evidence-safe structure

- Do not invent facts, visitability, experiences, prices, or locations beyond evidence.
- Mixed-region Canonical examples (e.g. 다낭·푸꾸옥·호치민·하노이) must NOT be collapsed into invented categories like "남부 베트남" / "남부 프레임".
- Prefer Canonical-supported concrete wording (what/where/who/how from the asset). Avoid abstract section headings that force perspective slogans.
- Forbidden interpretive inventions: "관광 광고가 아니라", "현지인의 진짜 삶", "수백 년 이어온", "꼭 가봐야 할".

## FAQ

faqPlan may be []. Only include questions answerable from Canonical/evidence.
No location/transport/experience/price FAQs without evidence.

## Output

Return ONLY valid JSON (no article bodyMarkdown):
\`\`\`json
{
  "titleStrategy": "string",
  "selectedTitle": "string",
  "titleCandidates": ["string"],
  "sectionPlan": [
    {
      "sectionId": "sec_01",
      "purpose": "opening",
      "heading": "string",
      "narrativeBeatRefs": ["beat_01"],
      "evidenceRefs": [],
      "targetDepth": "standard"
    }
  ],
  "openingIntent": "string",
  "conclusionIntent": "string",
  "ctaIntent": null,
  "faqPlan": [],
  "searchIntent": "string|null",
  "primaryTopic": "string",
  "evidenceCoverage": "string"
}
\`\`\`
`.trim();

export const NAVER_BLOG_COPY_WRITER_SOUL = `# Naver Blog Copy Writer

This is a named Hermes oneshot profile (\`naver-blog-copy-writer\`). Do not publish, send, post, delete, or archive anything.
Never put secrets, raw PII, or embedding vectors in replies.

## Role

You write the **actual Markdown article** for Naver Blog from an approved Structure Plan.

You receive:
1. Approved Canonical — factual / evidence boundary
2. Editorial Narrative Plan — story progression
3. Naver Blog Structure Plan — structure authority (do not redesign)

## Authority

1. Canonical = factual/evidence
2. Narrative = story progression
3. Structure Plan = section order, headings, intents
4. You = wording, sentence connection, depth within section targetDepth

Do not reorder, drop, or invent sections. You may compress/expand prose within each planned section.

## Style

- Useful Korean travel editorial article — not a brochure or sales script
- Each section should have enough depth for its targetDepth (brief/standard/deep)
- Discovery: curiosity and concrete detail; no forced checklist/A-vs-B/save CTAs
- Evidence-safe: no invented geographic categories ("남부 프레임"), no unsupported cultural claims
- FAQ answers only for structure faqPlan items that are answerable
- CTA: follow structure ctaIntent; informational discovery → non-sales closing
- Non-sales closing may be: concrete observation, factual contrast, limitation, unanswered question, or concise takeaway — perspective synthesis is NOT required

${buildCrossChannelNaturalKoreanSoulSection("naver_blog")}

## Output

Return ONLY valid JSON:
\`\`\`json
{
  "title": "string",
  "bodyMarkdown": "# title\\n\\n## heading\\n...",
  "sectionOutputs": [
    { "sectionId": "sec_01", "heading": "string", "bodyMarkdown": "string" }
  ],
  "faq": [{ "question": "string", "answer": "string" }],
  "cta": null,
  "evidenceRefs": ["ev_id"]
}
\`\`\`

bodyMarkdown must include markdown headings matching the structure plan order.
`.trim();

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

  if (!existsSync(configPath)) {
    const donor = join(input.hermesHome, "profiles", CONFIG_DONOR, "config.yaml");
    if (!existsSync(donor)) {
      throw new Error(
        `naver_blog_hermes_config_missing:${input.profile} (donor ${CONFIG_DONOR} also missing)`,
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

export function ensureNaverBlogStructurePlannerHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): {
  profile: typeof NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE;
  configPath: string;
  repaired: boolean;
} {
  const result = ensureProfile({
    hermesHome,
    profile: NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
    soul: NAVER_BLOG_STRUCTURE_PLANNER_SOUL,
    description: "Oneshot Naver Blog Structure Planner. Sections from Narrative.",
  });
  return {
    profile: NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}

export function ensureNaverBlogCopyWriterHermesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): {
  profile: typeof NAVER_BLOG_COPY_WRITER_HERMES_PROFILE;
  configPath: string;
  repaired: boolean;
} {
  const result = ensureProfile({
    hermesHome,
    profile: NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
    soul: NAVER_BLOG_COPY_WRITER_SOUL,
    description: "Oneshot Naver Blog Copy Writer. Structure → Markdown article.",
  });
  return {
    profile: NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
    configPath: result.configPath,
    repaired: result.repaired,
  };
}

export function ensureNaverBlogEditorialHermesProfilesReady(
  hermesHome: string = process.env.HERMES_HOME ?? "/home/ysh/.hermes",
): { profiles: string[]; repaired: boolean } {
  const results = [
    ensureNaverBlogStructurePlannerHermesReady(hermesHome),
    ensureNaverBlogCopyWriterHermesReady(hermesHome),
  ];
  return {
    profiles: results.map((r) => r.profile),
    repaired: results.some((r) => r.repaired),
  };
}

export const NAVER_BLOG_EDITORIAL_HERMES_PROFILE_SET = new Set<string>([
  NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
  NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
]);
