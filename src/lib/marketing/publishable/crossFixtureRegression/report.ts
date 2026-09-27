/**
 * Reviewer-friendly markdown report for a cross-fixture run.
 */

import type {
  ChannelAutomatedCheck,
  CrossFixtureRunReport,
  CrossFixtureVerdict,
  FixtureVerifyResult,
  ProductionBackedFixture,
} from "@/lib/marketing/publishable/crossFixtureRegression/types";
import { listProductionBackedFixtures } from "@/lib/marketing/publishable/crossFixtureRegression/fixtureManifest";

const CHANNEL_COL: Array<{ key: string; match: (c: ChannelAutomatedCheck) => boolean }> = [
  { key: "Narrative", match: (c) => c.channel === "narrative" },
  { key: "Threads", match: (c) => c.channel === "threads" },
  {
    key: "IG",
    match: (c) =>
      c.channel === "instagramCarousel" ||
      c.channel === "instagramCardCopy" ||
      c.channel === "instagramCaption",
  },
  {
    key: "Blog",
    match: (c) => c.channel === "blogStructure" || c.channel === "blogCopy",
  },
  { key: "Band", match: (c) => c.channel === "band" },
  { key: "Kakao", match: (c) => c.channel === "kakao" },
  { key: "Shortform", match: (c) => c.channel === "shortform" },
];

function groupVerdict(checks: ChannelAutomatedCheck[]): CrossFixtureVerdict {
  const rank: Record<CrossFixtureVerdict, number> = {
    PASS: 0,
    PASS_WITH_MINOR: 1,
    UNTESTED: 2,
    BLOCKED: 3,
    FAIL: 4,
  };
  return checks.reduce<CrossFixtureVerdict>((acc, c) => {
    return rank[c.overall] >= rank[acc] ? c.overall : acc;
  }, "PASS");
}

function archetypeLabel(fixtureId: string): string {
  const f = listProductionBackedFixtures().find((x) => x.fixtureId === fixtureId);
  return f?.role ?? "—";
}

export function buildFixtureSummaryTable(fixtures: FixtureVerifyResult[]): string {
  const header =
    "| Fixture | Archetype | Narrative | Threads | IG | Blog | Band | Kakao | Shortform | Overall |";
  const sep =
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const rows = fixtures.map((f) => {
    const cells = CHANNEL_COL.map((col) => {
      const matched = f.channels.filter(col.match);
      if (matched.length === 0) return "UNTESTED";
      return groupVerdict(matched);
    });
    return `| ${f.fixtureId} | ${archetypeLabel(f.fixtureId)} | ${cells.join(" | ")} | ${f.overall} |`;
  });
  return [header, sep, ...rows].join("\n");
}

export function buildChannelDetailTable(fixtures: FixtureVerifyResult[]): string {
  const header =
    "| Fixture | Worker | Freshness | Materialize | Style | Archetype Fit | Evidence | Verdict |";
  const sep = "| --- | --- | --- | --- | --- | --- | --- | --- |";
  const rows: string[] = [];
  for (const f of fixtures) {
    for (const c of f.channels) {
      rows.push(
        `| ${f.fixtureId} | ${c.channel} | ${c.freshness} | ${c.materialize} | ${c.style} | ${c.archetypeFit} | ${c.evidence} | ${c.overall} |`,
      );
    }
  }
  return [header, sep, ...rows].join("\n");
}

export function buildReviewerNotes(fixtures: FixtureVerifyResult[]): string {
  const lines: string[] = ["## Reviewer notes", ""];
  for (const f of fixtures) {
    lines.push(`### ${f.fixtureId}`, "");
    if (!f.eligible) {
      lines.push(`- **BLOCKED eligibility:** ${f.eligibilityBlockers.join("; ")}`);
      lines.push("");
      continue;
    }
    for (const c of f.channels) {
      const blockers = c.blockers.length ? ` blockers=${c.blockers.join("; ")}` : "";
      const notes = c.notes.length ? ` notes=${c.notes.join("; ")}` : "";
      lines.push(
        `- ${c.channel}: generatedAt=${c.generatedAt ?? "n/a"} path=${c.artifactPath ?? "n/a"}${blockers}${notes}`,
      );
    }
    lines.push("");
    lines.push(
      "_Semantic fields (style / archetypeFit / evidence) stay UNTESTED until manual review. Automated FAIL/BLOCKED on freshness/materialize blocks content PASS._",
    );
    lines.push("");
  }
  return lines.join("\n");
}

export function renderCrossFixtureMarkdownReport(input: {
  generatedAt: string;
  mode: CrossFixtureRunReport["mode"];
  inventoryMarkdown?: string;
  fixtures: FixtureVerifyResult[];
  productionFixtures?: ProductionBackedFixture[];
}): string {
  const lines: string[] = [
    "# Cross-fixture regression report",
    "",
    `- generatedAt: ${input.generatedAt}`,
    `- mode: ${input.mode}`,
    "",
  ];

  if (input.inventoryMarkdown) {
    lines.push(input.inventoryMarkdown, "");
  }

  lines.push("## Fixture summary", "", buildFixtureSummaryTable(input.fixtures), "");
  lines.push("## Channel detail", "", buildChannelDetailTable(input.fixtures), "");
  lines.push(buildReviewerNotes(input.fixtures));

  lines.push("## Baseline policy reminder", "");
  lines.push(
    "- Do not treat MINOR prose wording as immutable golden text.",
    "- Exact-string goldens are for deterministic helpers only (LEVEL 1).",
    "- A failing production artifact must not silently redefine the baseline.",
    "",
  );

  if (input.productionFixtures?.length) {
    lines.push("## Registered production fixtures", "");
    for (const f of input.productionFixtures) {
      lines.push(
        `- **${f.fixtureId}** (${f.role}) — ${f.packageRoot} / ${f.assetId}`,
        `  - commercialIntent: ${f.commercialIntent}`,
        `  - manual baseline reference (not prose goldens): ${JSON.stringify(f.baselineNotes)}`,
        `  - supportedFacts: ${f.supportedFacts.join("; ")}`,
        `  - limitations: ${f.limitations.join("; ")}`,
      );
    }
    lines.push("");
  }

  lines.push("## What remains manual", "");
  lines.push(
    "- Natural Korean quality / translationese",
    "- Archetype fit and forced abstract synthesis",
    "- Planner vocabulary leakage",
    "- Hook quality and evidence-safe dramatization",
    "- Mapping automated UNTESTED semantic cells to PASS / PASS_WITH_MINOR / FAIL after human review",
    "",
  );

  return lines.join("\n");
}
