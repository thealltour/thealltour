import { z } from "zod";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { lineageSchema, mutationSchema } from "./contracts";
import { stableFingerprint } from "./fingerprint";
import { mutateNarration, narrationLineage, NarrationError, readNarration } from "./persistence";
import { readNarrationResearch } from "./researchSource";

export const narrationResultSchema = z.object({
  contract: z.literal("narration-chatgpt-result-v1"), candidateId: z.string().min(1),
  handoffFingerprint: z.string().length(64), lineage: lineageSchema,
  expectedRevision: z.number().int().positive().nullable(), expectedFingerprint: z.string().length(64).nullable(),
  sentences: mutationSchema.shape.sentences.unwrap(),
}).strict();
export const narrationExchangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("handoff") }).strict(),
  z.object({ action: z.literal("import"), raw: z.string().min(1).max(500_000) }).strict(),
]);

export function buildNarrationHandoff(root: string, candidateId: string, asset: CanonicalMarketingAsset) {
  const lineage = narrationLineage(asset, root);
  const research = readNarrationResearch(root, asset);
  if (!research?.summary) throw new NarrationError("Research 검증 결과를 먼저 가져와주세요.");
  if (research.candidate.candidateId !== candidateId || research.candidate.assetId !== asset.assetId) {
    throw new NarrationError("다른 후보 또는 다른 원문의 Research입니다. 연결 정보를 확인해주세요.");
  }
  const current = readNarration(root, candidateId);
  const baseline = { expectedRevision: current?.revision ?? null, expectedFingerprint: current?.fingerprint ?? null };
  const payload = {
    contract: "narration-chatgpt-handoff-v1" as const, candidateId, lineage, ...baseline,
    approvedCanonical: asset,
    research: { importId: research.candidate.importId, fingerprint: research.fingerprint,
      status: research.summary.status, matchesCurrentCanonical: research.fresh, verification: research.candidate.result.research },
    existingNarration: current?.sentences ?? [],
    instructions: [
      "당신은 한국 여행객의 관심을 끌 이야기를 능동적으로 발굴하는 마케팅 Narration 작가이자 리서처입니다. 원문 요약보다 시청 이유와 발견을 우선하세요.",
      "approvedCanonical과 기존 Research는 출발 참조 자료이며 사용 가능한 사실의 상한선이 아닙니다. 원문에 없는 새 사실도 직접 조사·검증해 Narration에 사용할 수 있습니다. Canonical 선반영이나 재승인을 요구하지 마세요.",
      "흥미로운 각도가 약하면 먼저 웹에서 공식·1차 출처를 조사하고 여러 각도를 비교해 가장 강한 하나를 개발하세요. existingNarration의 구성에 얽매이지 마세요.",
      "기존 Research의 blocked/partial, 오래된 원문 버전, 사용 불가 finding, 원문 limitations/forbiddenClaims는 과거 검토 맥락입니다. 이를 자동 금지나 작성 중단 조건으로 쓰지 말고 직접 재조사해 현재 근거로 판단하세요.",
      "자유롭게 조사하되 사실을 창작하지 마세요. 출처·관찰 시점·조건을 확인하고 다른 시점의 경험을 하나의 현장처럼 합치지 마세요. 조사 근거는 내부 검토에 유지하고 provenance는 낭독문에 노출하지 마세요.",
      "한국어로 자연스러운 shortform narration을 만드세요. 공통원문의 흐름을 재구성하되 홍보문·기획서 문체를 피하세요.",
      "배열 원소 하나는 낭독 문장 하나입니다. 1 sentence = 1 visual = 1 scene. 여러 문장을 한 원소에 묶거나 한 문장을 쪼개지 마세요.",
      "1~16개 문장, 문장당 text 1~2000자, purpose는 null 또는 300자 이하입니다. 장면 병합·재사용·길이 맞추기·5개 고정을 금지합니다.",
      "duration은 실제 TTS가 결정합니다. duration/timing/visualPlan/Instagram copy 필드를 만들지 마세요.",
      "기존 문장의 정체성을 유지할 때만 해당 sentenceId를 보존하고, 새 문장은 sentenceId:null로 둡니다. UUID와 order는 서버가 관리합니다.",
      "아래 resultTemplate의 계약과 identity 필드를 그대로 복사하고 sentences만 작성하세요. JSON 객체만 반환하세요. 코드 펜스나 설명은 넣지 마세요.",
    ],
  };
  const fingerprint = stableFingerprint(payload);
  return { ...payload, handoffFingerprint: fingerprint, resultTemplate: {
    contract: "narration-chatgpt-result-v1" as const, candidateId, handoffFingerprint: fingerprint,
    lineage, ...baseline, sentences: [{ sentenceId: null, text: "", purpose: null }],
  } };
}

export function importNarrationResult(root: string, candidateId: string, raw: string, getSource: () => CanonicalMarketingAsset) {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new NarrationError("JSON 객체만 붙여넣어주세요.", 400); }
  const parsed = narrationResultSchema.safeParse(value);
  if (!parsed.success) throw new NarrationError("Narration 결과 계약·문장·identity를 확인해주세요.", 400);
  const result = parsed.data;
  const current = buildNarrationHandoff(root, candidateId, getSource());
  if (result.candidateId !== candidateId || result.handoffFingerprint !== current.handoffFingerprint ||
    stableFingerprint(result.lineage) !== stableFingerprint(current.lineage) ||
    result.expectedRevision !== current.expectedRevision || result.expectedFingerprint !== current.expectedFingerprint) {
    throw new NarrationError("원문·Research·Narration이 변경됐거나 다른 후보의 결과입니다. 새 handoff로 다시 작성해주세요.");
  }
  return mutateNarration(root, candidateId, { action: "save", lineage: result.lineage,
    expectedRevision: result.expectedRevision, expectedFingerprint: result.expectedFingerprint, sentences: result.sentences },
  () => narrationLineage(getSource(), root), { forceDraft: true });
}
