import {
  RESEARCH_SOURCE_LIFECYCLE_STATUSES,
  type ResearchSourceLifecycleStatus,
  type ResearchSourceSemantics,
} from "@/lib/marketing/research/types/sourceSemantics";

/**
 * Lifecycle is future-participation policy only: it never deletes or rewrites existing
 * sources, signals, briefs or candidates. `retired` behaves exactly like `paused` at runtime.
 */
const LIFECYCLE_PARTICIPATION: Record<
  ResearchSourceLifecycleStatus,
  { collect: boolean; candidates: boolean; mm: boolean }
> = {
  active: { collect: true, candidates: true, mm: true },
  shadow: { collect: true, candidates: false, mm: false },
  paused: { collect: false, candidates: false, mm: false },
  retired: { collect: false, candidates: false, mm: false },
};

export const SOURCE_LIFECYCLE_INACTIVE = "source_lifecycle_inactive";

/** Registry definition (`semantics`) or persisted row (`metadata.semantics`). */
export type ResearchSourceLifecycleCarrier =
  | { semantics: ResearchSourceSemantics }
  | { metadata?: Record<string, unknown> | null }
  | null
  | undefined;

function isLifecycleStatus(value: unknown): value is ResearchSourceLifecycleStatus {
  return (RESEARCH_SOURCE_LIFECYCLE_STATUSES as readonly unknown[]).includes(value);
}

/** Missing or malformed lifecycle is unresolved and cannot participate. */
export function resolveSourceLifecycleStatus(source: ResearchSourceLifecycleCarrier): ResearchSourceLifecycleStatus | null {
  if (!source) return null;
  const semantics: unknown = "semantics" in source ? source.semantics : source.metadata?.semantics;
  if (!semantics || typeof semantics !== "object") return null;
  const lifecycle = (semantics as { lifecycle?: unknown }).lifecycle;
  if (!lifecycle || typeof lifecycle !== "object") return null;
  const status = (lifecycle as { status?: unknown }).status;
  return isLifecycleStatus(status) ? status : null;
}

export const SOURCE_SEMANTICS_UNRESOLVED = "source_semantics_unresolved";

export function sourceLifecycleRejectionReason(source: ResearchSourceLifecycleCarrier): string {
  return resolveSourceLifecycleStatus(source) === null ? SOURCE_SEMANTICS_UNRESOLVED : SOURCE_LIFECYCLE_INACTIVE;
}

export function canCollectResearchSource(source: ResearchSourceLifecycleCarrier): boolean {
  const status = resolveSourceLifecycleStatus(source);
  return status !== null && LIFECYCLE_PARTICIPATION[status].collect;
}

export function canSourceParticipateInCandidates(source: ResearchSourceLifecycleCarrier): boolean {
  const status = resolveSourceLifecycleStatus(source);
  return status !== null && LIFECYCLE_PARTICIPATION[status].candidates;
}

export function canSourceParticipateInMm(source: ResearchSourceLifecycleCarrier): boolean {
  const status = resolveSourceLifecycleStatus(source);
  return status !== null && LIFECYCLE_PARTICIPATION[status].mm;
}
