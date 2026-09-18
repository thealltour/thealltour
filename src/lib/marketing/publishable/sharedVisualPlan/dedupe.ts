/**
 * Conservative cross-channel visual dedupe for deterministic fallback only.
 * reusableOn* Worker flags are NOT merge gates (advisory).
 * False merge < false split. Same-channel requests never merge.
 */

import type { SocialVisualRequest } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import type { SharedVisualMode } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  intentTokenOverlapRatio,
  normalizeRoleFamily,
  type RoleFamily,
} from "@/lib/marketing/publishable/sharedVisualPlan/normalize";

const INCOMPATIBLE_MODE_PAIRS: Array<[SharedVisualMode, SharedVisualMode]> = [
  ["editorial_photo", "fact_card"],
  ["editorial_photo", "evidence_boundary"],
  ["editorial_photo", "icon_infographic"],
  ["editorial_photo", "contrast_diagram"],
  ["object_or_detail", "fact_card"],
  ["object_or_detail", "evidence_boundary"],
  ["object_or_detail", "map_context"],
  ["map_context", "object_or_detail"],
  ["map_context", "fact_card"],
  ["icon_infographic", "editorial_photo"],
  ["contrast_diagram", "editorial_photo"],
  ["fact_card", "editorial_photo"],
  ["evidence_boundary", "editorial_photo"],
];

const INCOMPATIBLE_ROLE_PAIRS: Array<[RoleFamily, RoleFamily]> = [
  ["context_cover", "object_detail"],
  ["context_cover", "evidence"],
  ["context_cover", "fact"],
  ["subject_detail", "object_detail"],
  ["subject_detail", "map_context"],
  ["object_detail", "map_context"],
  ["object_detail", "context_cover"],
  ["evidence", "context_cover"],
  ["fact", "context_cover"],
  ["closing", "context_cover"],
  ["closing", "subject_detail"],
];

function modesCompatible(
  a: SharedVisualMode | undefined,
  b: SharedVisualMode | undefined,
): boolean {
  if (!a || !b) return true; // missing mode is permissive only when other signals agree
  if (a === b) return true;
  for (const [x, y] of INCOMPATIBLE_MODE_PAIRS) {
    if ((a === x && b === y) || (a === y && b === x)) return false;
  }
  // Different but not explicitly incompatible — still refuse (conservative).
  return false;
}

function rolesCompatible(a: RoleFamily, b: RoleFamily): boolean {
  if (a === "unknown" || b === "unknown") return false;
  if (a === b) return true;
  // Weak adjacent families that can share an establishing visual.
  if (
    (a === "context_cover" && b === "information") ||
    (a === "information" && b === "context_cover")
  ) {
    return true;
  }
  for (const [x, y] of INCOMPATIBLE_ROLE_PAIRS) {
    if ((a === x && b === y) || (a === y && b === x)) return false;
  }
  return false;
}

/** Strong subject cues that must not be mixed across incompatible details. */
function subjectConflict(a: string, b: string): boolean {
  const pairHints: Array<[RegExp, RegExp]> = [
    [/산악|국경|지역|region|establishing|분위기|풍경|cover|맥락/i, /건축|흙다짐|nhà|trình|tường|architecture|detail|클로즈|close.?up/i],
    [/Dao|다오|people|족\b|인물|생활문화/i, /건축|흙다짐|nhà|trình|tường|architecture/i],
    [/infographic|도표|아이콘/i, /사진|photo|editorial/i],
  ];
  for (const [left, right] of pairHints) {
    const ab = left.test(a) && right.test(b);
    const ba = left.test(b) && right.test(a);
    if (ab || ba) return true;
  }
  return false;
}

export function canMergeVisualRequests(a: SocialVisualRequest, b: SocialVisualRequest): boolean {
  // Same channel → never merge (each slot/card keeps its own request identity).
  if (a.sourceChannel === b.sourceChannel) return false;
  // reusableCrossChannel is ADVISORY only — do not require both true.
  // Planner / semantic signals decide reuse; flags are ignored as hard gates.

  const fa = normalizeRoleFamily(a.role);
  const fb = normalizeRoleFamily(b.role);
  if (!rolesCompatible(fa, fb)) return false;
  if (!modesCompatible(a.visualMode, b.visualMode)) return false;

  const intentA = a.visualIntent || "";
  const intentB = b.visualIntent || "";
  if (subjectConflict(intentA, intentB) || subjectConflict(`${a.role} ${intentA}`, `${b.role} ${intentB}`)) {
    return false;
  }

  const overlap = intentTokenOverlapRatio(intentA, intentB);
  // Require meaningful intent overlap when both have text; allow role-only merge only if both intents empty.
  if (intentA.trim() && intentB.trim()) {
    if (overlap < 0.28) return false;
  } else if (intentA.trim() || intentB.trim()) {
    // One side empty intent — too weak to merge.
    return false;
  }

  return true;
}

export type VisualRequestGroup = {
  members: SocialVisualRequest[];
};

/**
 * Greedy, order-stable merge:
 * Walk Instagram-first request list; for each Threads request, attach to the
 * earliest compatible Instagram group (or vice versa via pairwise scan).
 */
export function groupVisualRequests(requests: SocialVisualRequest[]): VisualRequestGroup[] {
  const groups: VisualRequestGroup[] = requests.map((r) => ({ members: [r] }));

  // Merge pass: only cross-channel pairs; earlier group absorbs later.
  for (let i = 0; i < groups.length; i++) {
    const gi = groups[i];
    if (!gi || gi.members.length === 0) continue;
    for (let j = i + 1; j < groups.length; j++) {
      const gj = groups[j];
      if (!gj || gj.members.length === 0) continue;
      // Only merge singleton-or-group if every cross pair is compatible
      // and channels differ across the combined set.
      const channels = new Set(
        [...gi.members, ...gj.members].map((m) => m.sourceChannel),
      );
      if (channels.size < 2) continue;

      let ok = true;
      for (const a of gi.members) {
        for (const b of gj.members) {
          if (a.sourceChannel === b.sourceChannel) continue;
          if (!canMergeVisualRequests(a, b)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) continue;

      // Absorb j into i; clear j.
      gi.members.push(...gj.members);
      gj.members = [];
    }
  }

  return groups.filter((g) => g.members.length > 0);
}
