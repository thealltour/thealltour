import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import { narrationSchema, type Narration, type NarrationLineage, type NarrationMutation } from "./contracts";
import { stableFingerprint } from "./fingerprint";

export class NarrationError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const hash = stableFingerprint;
export function narrationLineage(asset: CanonicalMarketingAsset): NarrationLineage {
  if (!isApprovedCanonicalAsset(asset)) throw new NarrationError("공통 원문을 먼저 승인해주세요.");
  // Explicit projection excludes audit timestamps and includes factual boundaries.
  return { assetId: asset.assetId, canonicalVersion: asset.version, sourceRevision: asset.sourceRevision,
    canonicalFingerprint: hash({ assetId: asset.assetId, version: asset.version, sourceRevision: asset.sourceRevision,
      titleKo: asset.titleKo, dekKo: asset.dekKo, openingHookKo: asset.openingHookKo, bodyKo: asset.bodyKo,
      keyTakeawaysKo: asset.keyTakeawaysKo, decisionGuidanceKo: asset.decisionGuidanceKo,
      optionalCtaIntentKo: asset.optionalCtaIntentKo, evidenceRefs: asset.evidenceRefs,
      limitationsKo: asset.limitationsKo, forbiddenClaimsKo: asset.forbiddenClaimsKo,
      supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo, unresolvedQuestionsKo: asset.unresolvedQuestionsKo,
      storySupportVerdict: asset.storySupportVerdict, evidenceRevision: asset.evidenceRevision, propositionRevision: asset.propositionRevision,
      editorialArchetype: asset.editorialArchetype ?? null, researchRevision: asset.researchRevision ?? null }) };
}
export function contentFingerprint(value: Pick<Narration, "candidateId" | "lineage" | "sentences">) {
  return hash({ contract: "editorial-narration-v1", candidateId: value.candidateId, lineage: value.lineage, sentences: value.sentences });
}
export function readNarration(root: string, candidateId: string): Narration | null {
  const path = join(root, "context/narration/current.json");
  if (!existsSync(path)) return null;
  const parsed = narrationSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) throw new NarrationError("Narration 저장 파일 형식을 확인해주세요.", 500);
  const value = parsed.data;
  if (value.candidateId !== candidateId || contentFingerprint(value) !== value.fingerprint ||
      new Set(value.sentences.map(s => s.sentenceId)).size !== value.sentences.length ||
      value.sentences.some((s, index) => s.order !== index) ||
      (value.approval && (value.approval.revision !== value.revision || value.approval.fingerprint !== value.fingerprint))) {
    throw new NarrationError("Narration 저장 파일의 연결 정보가 일치하지 않습니다.", 500);
  }
  return value;
}
export function narrationGate(value: Narration | null, lineage: NarrationLineage) {
  if (!value) return "missing" as const;
  if (hash(value.lineage) !== hash(lineage)) return "stale" as const;
  return value.approval ? "approved" as const : "draft" as const;
}
export function mutateNarration(root: string, candidateId: string, input: NarrationMutation, getLineage: () => NarrationLineage): Narration {
  const directory = join(root, "context/narration");
  mkdirSync(directory, { recursive: true });
  const lock = join(directory, ".mutation-lock");
  try { mkdirSync(lock); } catch { throw new NarrationError("다른 저장이 진행 중입니다. 잠시 후 다시 저장해주세요."); }
  let temporary: string | null = null;
  try {
    const lineage = getLineage();
    if (hash(input.lineage) !== hash(lineage)) throw new NarrationError("공통 원문이 바뀌었습니다. 다시 불러온 후 검토해주세요.");
    const current = readNarration(root, candidateId);
    if ((current?.revision ?? null) !== input.expectedRevision || (current?.fingerprint ?? null) !== input.expectedFingerprint) {
      throw new NarrationError("다른 화면에서 Narration을 수정했습니다. 다시 불러와주세요.");
    }
    let next: Narration;
    if (input.action === "approve") {
      if (!current || narrationGate(current, lineage) === "stale") throw new NarrationError("현재 공통 원문 기준으로 Narration을 저장한 후 승인해주세요.");
      next = { ...current, approval: { revision: current.revision, fingerprint: current.fingerprint, approvedAt: new Date().toISOString() } };
    } else {
      if (!input.sentences) throw new NarrationError("문장을 입력해주세요.", 400);
      const knownIds = new Set(current?.sentences.map(s => s.sentenceId) ?? []);
      const ids = input.sentences.flatMap(s => s.sentenceId ? [s.sentenceId] : []);
      if (new Set(ids).size !== ids.length || ids.some(id => !knownIds.has(id))) throw new NarrationError("문장 ID가 중복되거나 현재 Narration에 속하지 않습니다.", 400);
      const sentences = input.sentences.map((sentence, order) => ({ ...sentence, sentenceId: sentence.sentenceId ?? randomUUID(), order }));
      const fingerprint = contentFingerprint({ candidateId, lineage, sentences });
      if (current?.fingerprint === fingerprint) return current;
      next = { contract: "editorial-narration-v1", candidateId, revision: (current?.revision ?? 0) + 1,
        fingerprint, lineage, sentences, createdAt: new Date().toISOString(), approval: null };
    }
    if (hash(getLineage()) !== hash(lineage)) throw new NarrationError("저장 중 공통 원문이 바뀌었습니다. 다시 불러와주세요.");
    // Archive only the previous published revision. A failed pointer write can be retried safely.
    if (current && next.revision !== current.revision) {
      const revisions = join(directory, "revisions"); mkdirSync(revisions, { recursive: true });
      const archive = join(revisions, `${current.revision}-${current.fingerprint}.json`);
      if (!existsSync(archive)) writeFileSync(archive, JSON.stringify(current, null, 2) + "\n", { flag: "wx" });
    }
    temporary = join(directory, `.current-${randomUUID()}.json`);
    writeFileSync(temporary, JSON.stringify(next, null, 2) + "\n", { flag: "wx" });
    renameSync(temporary, join(directory, "current.json")); temporary = null;
    return next;
  } finally {
    if (temporary) rmSync(temporary, { force: true });
    rmSync(lock, { recursive: true });
  }
}
