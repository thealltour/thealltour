/**
 * Deterministic evidence → visual safety constraints for Manual Astra handoff.
 * Does not invent evidence or rewrite Story.
 */

import type { ManualAstraApprovedAssetContext } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import type { SharedVisual } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

const COMMON_SAFETY = [
  "Generated imagery is illustrative editorial material, not documentary proof.",
  "Do not compose the image to look like a verified on-site documentary photograph.",
];

function truncateConstraint(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function limitationToVisualConstraint(limitation: string): string | null {
  const t = limitation.trim();
  if (!t) return null;
  if (/마을|위치|지명|village|location/i.test(t)) {
    return `Do not identify or imply a specific named village/location (${truncateConstraint(t, 100)}).`;
  }
  if (/체험|활동|투어|activity|experience/i.test(t)) {
    return `Do not depict specific tourist activities or offerings as available (${truncateConstraint(t, 100)}).`;
  }
  if (/요금|가격|일정|price|schedule/i.test(t)) {
    return `Do not imply verified prices, schedules, or operational availability (${truncateConstraint(t, 100)}).`;
  }
  return `Respect evidence limitation visually: ${truncateConstraint(t)}.`;
}

function forbiddenToVisualConstraint(claim: string): string | null {
  const t = claim.trim();
  if (!t) return null;
  // Never restate the forbidden claim as a positive direction.
  if (/삶|생활|현지인|주민|people|life/i.test(t)) {
    return "Avoid staged scenes implying privileged or complete access to residents' private life.";
  }
  if (/고스란히|완벽|전부|모두|entire|complete/i.test(t)) {
    return "Avoid absolute/complete-access framing that overstates what evidence supports.";
  }
  return `Do not visually assert a forbidden/unsupported claim (constraint derived from approved asset).`;
}

function culturalPeopleNotes(visual: SharedVisual): string[] {
  const hay = `${visual.role} ${visual.visualIntent}`.toLowerCase();
  if (!/(족|people|인물|주민|문화|ethnic|dao|다오|community)/i.test(hay)) return [];
  return [
    "Avoid costume fantasy, exaggerated exoticism, or stereotyped ceremonial depiction.",
    "Prefer contextual/editorial representation over documentary claims about a named community.",
    "If human depiction certainty is weak, prefer architecture/environment/detail framing.",
  ];
}

export function buildEvidenceGuidance(input: {
  visual: SharedVisual;
  asset: ManualAstraApprovedAssetContext | null | undefined;
}): string[] {
  const out: string[] = [...COMMON_SAFETY];
  const asset = input.asset;

  const boundary = asset?.supportedClaimBoundaryKo?.trim();
  if (boundary) {
    out.push(`Stay within supported claim boundary: ${truncateConstraint(boundary)}.`);
  }

  for (const lim of asset?.limitationsKo ?? []) {
    const c = limitationToVisualConstraint(lim);
    if (c) out.push(c);
  }

  for (const forbidden of asset?.forbiddenClaimsKo ?? []) {
    const c = forbiddenToVisualConstraint(forbidden);
    if (c) out.push(c);
  }

  const verdict = asset?.storySupportVerdict?.trim();
  if (verdict && /INSUFFICIENT|UNSUPPORTED|BLOCK/i.test(verdict)) {
    out.push("Story support is limited — keep imagery clearly illustrative, not evidentiary.");
  }

  out.push(...culturalPeopleNotes(input.visual));

  // Dedupe while preserving order
  const seen = new Set<string>();
  return out.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
