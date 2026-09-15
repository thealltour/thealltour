import { createHash } from "node:crypto";

import type { StoryContentPoint, StoryMechanism } from "@/lib/marketing/storyPoint/contracts";

function norm(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stable semantic fingerprint for a StoryPoint (no timestamps).
 * Later becomes part of RA-1 research cache key.
 */
export function createStoryPointHash(point: Pick<
  StoryContentPoint,
  | "storyQuestion"
  | "storyClaim"
  | "curiosityGap"
  | "readerPayoff"
  | "researchQuestions"
  | "mechanisms"
>): string {
  const payload = [
    norm(point.storyQuestion),
    norm(point.storyClaim),
    norm(point.curiosityGap),
    norm(point.readerPayoff),
    [...(point.researchQuestions ?? [])].map(norm).sort().join("|"),
    [...(point.mechanisms ?? [])].slice().sort().join(","),
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 32);
}

export function createStoryPointInputRevision(parts: {
  agendaId: string;
  assignmentId: string;
  agendaTitle: string;
  agendaSummary: string;
  assignmentObjective?: string | null;
  commercialIntent?: string | null;
  evidenceSnippet?: string | null;
}): string {
  const payload = [
    parts.agendaId.trim(),
    parts.assignmentId.trim(),
    norm(parts.agendaTitle),
    norm(parts.agendaSummary),
    norm(parts.assignmentObjective),
    norm(parts.commercialIntent),
    norm(parts.evidenceSnippet).slice(0, 400),
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 24);
}

export function mechanismKey(mechanisms: StoryMechanism[]): string {
  return [...mechanisms].sort().join("+");
}
