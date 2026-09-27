/**
 * Inventory of existing regression assets vs what the harness owns.
 */

export type InventorySection = {
  title: string;
  items: string[];
};

export function buildRegressionInventory(): InventorySection[] {
  return [
    {
      title: "What already exists",
      items: [
        "Production packages under /mnt/HDD2TB/marketing-assets (only 2 approved Canonicals today).",
        "Worker surgical unit tests (forced CTA, Card Copy geo, Kakao/Shortform/Band/Caption contracts).",
        "Deterministic helpers: forcedCtaDetection, geographic evidence checks, debt classifiers.",
        "Ad-hoc /tmp oneshot regenerate scripts used during manual cross-fixture batch.",
        "Canonical approval gate: isApprovedCanonicalAsset.",
      ],
    },
    {
      title: "What can be reused",
      items: [
        "isApprovedCanonicalAsset for production-backed eligibility.",
        "Existing L1 unit tests remain the source of truth for detectors/helpers.",
        "Package context/*.json artifact layout for freshness/materialize checks.",
        "Manually verified Dao + Phu Quoc baselines as behavioral reference notes (not prose goldens).",
      ],
    },
    {
      title: "What is duplicated (avoid expanding)",
      items: [
        "Do not re-assert every forced-CTA / geo regex case inside the production harness.",
        "Do not snapshot full channel prose as exact golden text.",
        "Ad-hoc /tmp regen scripts are operator aids — harness verify/report replaces their checklist role, not their compose calls.",
      ],
    },
    {
      title: "Remain unit-level (LEVEL 1–2)",
      items: [
        "forcedCtaDetection.test.ts — imperative vs topic CTA.",
        "cardCopyGeographicEvidence / Narrative geo tests.",
        "Kakao / Shortform / Band surgical contract tests.",
        "Schema materialization and artifact authority unit tests.",
      ],
    },
    {
      title: "Belong in cross-fixture regression (LEVEL 3)",
      items: [
        "Dao northern-border contrast — discovery/cultural/contrast archetype.",
        "Phu Quoc hotel booking-vs-wait — decision/comparison archetype.",
        "Future slots only when a real approved Canonical exists (practical, commercial, geo, dramatic hook).",
        "Freshness / fingerprint / missing-artifact / eligibility reporting across channels.",
      ],
    },
  ];
}

export function formatInventoryMarkdown(sections: InventorySection[]): string {
  const lines: string[] = ["# Cross-fixture regression inventory", ""];
  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
