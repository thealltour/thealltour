import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  THREADS_COPY_CONTRACT,
  THREADS_COPY_ENDING_INTENTS,
  THREADS_COPY_WRITER_HERMES_PROFILE,
  type ThreadsCopyArtifact,
  type ThreadsCopyEndingIntent,
} from "@/lib/marketing/publishable/threadsCopy/contracts";
import { THREADS_BODY_MAX_CHARS, stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

export class ThreadsCopyMaterializeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ThreadsCopyMaterializeError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ThreadsCopyMaterializeError("missing_field", `${field} required`);
  }
  return value.trim();
}

function isEndingIntent(value: unknown): value is ThreadsCopyEndingIntent {
  return (
    typeof value === "string" &&
    (THREADS_COPY_ENDING_INTENTS as readonly string[]).includes(value)
  );
}

/** Forced CTA / brochure engagement phrasing that Threads specialist must not emit. */
export const FORCED_THREADS_CTA_RE =
  /저장해\s*두(?:고|세요)|비교해\s*보(?:세요|아요)|댓글(?:로)?\s*(?:달아|남겨)|클릭해\s*보|링크(?:를)?\s*(?:눌러|클릭)|팔로우해|지금\s*예약/i;

export function hasForcedThreadsCta(body: string): boolean {
  return FORCED_THREADS_CTA_RE.test(body);
}

export function materializeThreadsCopy(input: {
  assetId: string;
  assetVersion: number;
  sourceNarrativeFingerprint: string;
  narrative: EditorialNarrativePlan;
  modelProfile?: string;
  generatedAt?: string;
  llm: unknown;
}): ThreadsCopyArtifact {
  const root = asRecord(input.llm);
  if (!root) {
    throw new ThreadsCopyMaterializeError("invalid_llm", "Threads copy LLM output must be an object");
  }

  const bodyRaw = requireNonEmptyString(root.body, "body");
  const body = stripEvidenceIdsFromText(bodyRaw);
  if (!body) {
    throw new ThreadsCopyMaterializeError("empty_body", "Threads body empty after sanitize");
  }
  if (body.length > THREADS_BODY_MAX_CHARS) {
    throw new ThreadsCopyMaterializeError(
      "too_long",
      `Threads body ${body.length} exceeds ${THREADS_BODY_MAX_CHARS}`,
    );
  }
  if (hasForcedThreadsCta(body)) {
    throw new ThreadsCopyMaterializeError(
      "forced_cta",
      "Threads body contains forced engagement/CTA phrasing",
    );
  }

  const validBeatIds = new Set(input.narrative.beats.map((b) => b.beatId));
  const selectedRaw = Array.isArray(root.selectedNarrativeBeats)
    ? root.selectedNarrativeBeats
    : Array.isArray(root.selected_narrative_beats)
      ? root.selected_narrative_beats
      : [];
  const selectedNarrativeBeats = selectedRaw
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim());
  if (selectedNarrativeBeats.length < 1) {
    throw new ThreadsCopyMaterializeError(
      "beats_required",
      "selectedNarrativeBeats must include at least one beat",
    );
  }
  for (const beatId of selectedNarrativeBeats) {
    if (!validBeatIds.has(beatId)) {
      throw new ThreadsCopyMaterializeError("unknown_beat", `Unknown beatId: ${beatId}`);
    }
  }

  const endingRaw = root.endingIntent ?? root.ending_intent ?? "observation";
  if (!isEndingIntent(endingRaw)) {
    throw new ThreadsCopyMaterializeError("invalid_ending", "endingIntent invalid");
  }

  const evidenceRefs = Array.isArray(root.evidenceRefs)
    ? root.evidenceRefs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : Array.isArray(root.evidence_refs)
      ? root.evidence_refs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];

  return {
    contract: THREADS_COPY_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    body,
    selectedNarrativeBeats,
    endingIntent: endingRaw,
    evidenceRefs,
    sourceNarrativeFingerprint: input.sourceNarrativeFingerprint,
    mediaPlan: root.mediaPlan ?? root.media_plan ?? null,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile ?? THREADS_COPY_WRITER_HERMES_PROFILE,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceNarrativeFingerprint: input.sourceNarrativeFingerprint,
    },
  };
}
