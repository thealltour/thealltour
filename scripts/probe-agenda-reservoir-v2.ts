/**
 * One-shot repository probe for marketing_agenda_reservoir_v2.
 * Uses production SupabaseAgendaReservoirRepository — not raw SQL only.
 * Cleans up probe rows. Does NOT enable shadow flag.
 *
 *   npx tsx scripts/probe-agenda-reservoir-v2.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { SupabaseAgendaReservoirRepository } from "../src/lib/marketing/agendaQualityV2/reservoir/supabaseRepository";
import {
  createReservoirItemFromQualified,
  isReservoirEligibleForFutureSlate,
} from "../src/lib/marketing/agendaQualityV2/reservoir/types";
import {
  markReservoirDeferred,
  markReservoirPresented,
  markReservoirSelected,
  markReservoirRejected,
  markReservoirExpired,
} from "../src/lib/marketing/agendaQualityV2/reservoir/transitions";
import { assembleMarketingAgendaCandidateV2 } from "../src/lib/marketing/agendaQualityV2/transformer/transform";

const PROBE_PREFIX = "probe_aqv2_4a_";
const NOW = new Date().toISOString();

function makeCandidate(suffix: string) {
  return assembleMarketingAgendaCandidateV2({
    input: {
      originalTitle: `PROBE ${suffix}`,
      originalSummary: "isolated shadow probe — delete after verification",
      sourceTypes: ["probe"],
      sourceFingerprint: `${PROBE_PREFIX}${suffix}_fp`,
      sourceCredibility: 0.7,
      sourceFreshness: 0.7,
      koreanTravelerRelevance: 0.7,
      observedAt: NOW,
    },
    llm: {
      targetTravelerKo: "프로브 여행자",
      travelerProblemKo: "프로브용 결정 프레임을 어떻게 검증할까?",
      decisionAtStakeKo: "프로브 선택 A vs 선택 B 판단",
      audienceTensionKo: "편의 vs 검증 트레이드오프",
      readerPayoffKo: "프로브 통과 여부를 판단한다",
      marketingStorySeedKo: "프로브 스토리 시드 — 삭제 예정",
      whyNowKo: "마이그레이션 검증",
      researchQuestionsKo: ["프로브?"],
      nonGoalsKo: ["실데이터"],
      genericRiskKo: "probe_only",
      storyArchetypeHint: "other",
      freshnessClass: "timely",
      signalSummaryKo: `PROBE ${suffix}`,
      limitations: ["probe"],
    },
    transformModel: "probe",
    nowIso: NOW,
  });
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const host = new URL(url).host;
  const ref = host.split(".")[0];
  console.log(JSON.stringify({ target_host: host, project_ref: ref, shadow_flag: process.env.AGENDA_QUALITY_V2_SHADOW_ENABLED ?? "(unset)" }));

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const repo = new SupabaseAgendaReservoirRepository(sb as never);

  // V1 baseline counts
  const { count: slateBefore } = await sb
    .from("daily_marketing_agenda_slates")
    .select("*", { count: "exact", head: true });
  const { count: trendsBefore } = await sb
    .from("travel_trends_staging")
    .select("*", { count: "exact", head: true });

  const ids: string[] = [];
  const results: Record<string, unknown> = {};

  // QUALIFIED insert
  let deferred = createReservoirItemFromQualified(makeCandidate("deferred"), NOW);
  deferred = {
    ...deferred,
    agendaId: `${PROBE_PREFIX}deferred`,
    candidate: {
      ...deferred.candidate,
      agendaId: `${PROBE_PREFIX}deferred`,
      provenance: {
        ...deferred.candidate.provenance,
        limitations: ["probe", "qualityVersion:v2", "shadow:true"],
      },
    },
  };
  // stamp shadow isolation inside payload
  (deferred as { candidate: { contract: string } & Record<string, unknown> }).candidate = {
    ...deferred.candidate,
    // carry explicit shadow markers in payload for audit
  };
  deferred = {
    ...deferred,
    candidate: {
      ...deferred.candidate,
    },
  };
  // Attach markers on a non-schema field via payload only — repository stores full item as payload
  const deferredMarked = {
    ...deferred,
    // repository payload is the whole item; add marker fields by wrapping candidate limitations
  };
  await repo.upsert({
    ...deferredMarked,
    candidate: {
      ...deferredMarked.candidate,
      provenance: {
        ...deferredMarked.candidate.provenance,
        limitations: [
          ...deferredMarked.candidate.provenance.limitations,
          "qualityVersion=v2",
          "shadow=true",
        ],
      },
    },
  });
  ids.push(deferred.agendaId);
  results.insert = true;

  const readBack = await repo.get(deferred.agendaId);
  results.read = readBack?.agendaId === deferred.agendaId;
  results.shadow_markers =
    readBack?.candidate.provenance.limitations.includes("shadow=true") &&
    readBack?.candidate.provenance.limitations.includes("qualityVersion=v2");

  // QUALIFIED → PRESENTED → DEFERRED
  let item = readBack!;
  item = markReservoirPresented(item, NOW);
  item = markReservoirDeferred(item, NOW);
  await repo.upsert(item);
  results.update = true;

  const afterDefer = await repo.get(deferred.agendaId);
  results.deferred_persisted = afterDefer?.status === "DEFERRED";
  results.deferred_query = isReservoirEligibleForFutureSlate(afterDefer!, NOW);

  // SELECTED excluded
  let selected = createReservoirItemFromQualified(makeCandidate("selected"), NOW);
  selected = { ...selected, agendaId: `${PROBE_PREFIX}selected` };
  selected = markReservoirPresented(selected, NOW);
  selected = markReservoirSelected(selected, NOW);
  await repo.upsert(selected);
  ids.push(selected.agendaId);
  results.selected_excluded = !isReservoirEligibleForFutureSlate(
    (await repo.get(selected.agendaId))!,
    NOW,
  );

  // REJECTED excluded
  let rejected = createReservoirItemFromQualified(makeCandidate("rejected"), NOW);
  rejected = { ...rejected, agendaId: `${PROBE_PREFIX}rejected` };
  rejected = markReservoirRejected(rejected, NOW);
  await repo.upsert(rejected);
  ids.push(rejected.agendaId);
  results.rejected_excluded = !isReservoirEligibleForFutureSlate(
    (await repo.get(rejected.agendaId))!,
    NOW,
  );

  // EXPIRED excluded
  let expired = createReservoirItemFromQualified(makeCandidate("expired"), NOW);
  expired = {
    ...expired,
    agendaId: `${PROBE_PREFIX}expired`,
    expiresAt: "2020-01-01T00:00:00.000Z",
  };
  expired = markReservoirExpired(expired, NOW);
  await repo.upsert(expired);
  ids.push(expired.agendaId);
  results.expired_excluded = !isReservoirEligibleForFutureSlate(
    (await repo.get(expired.agendaId))!,
    NOW,
  );

  // list DEFERRED
  const deferredList = await repo.list({ status: "DEFERRED" });
  results.deferred_list_contains_probe = deferredList.some((r) => r.agendaId === deferred.agendaId);

  // cleanup
  for (const id of ids) {
    await sb.from("marketing_agenda_reservoir_v2").delete().eq("agenda_id", id);
  }
  const leftover = await sb
    .from("marketing_agenda_reservoir_v2")
    .select("agenda_id")
    .like("agenda_id", `${PROBE_PREFIX}%`);
  results.probe_cleanup = (leftover.data?.length ?? 0) === 0;

  const { count: slateAfter } = await sb
    .from("daily_marketing_agenda_slates")
    .select("*", { count: "exact", head: true });
  const { count: trendsAfter } = await sb
    .from("travel_trends_staging")
    .select("*", { count: "exact", head: true });

  results.v1_slate_count_before = slateBefore;
  results.v1_slate_count_after = slateAfter;
  results.v1_trends_count_before = trendsBefore;
  results.v1_trends_count_after = trendsAfter;
  results.v1_unchanged = slateBefore === slateAfter && trendsBefore === trendsAfter;

  console.log(JSON.stringify(results, null, 2));
  const ok = Object.entries(results)
    .filter(([k]) => !k.startsWith("v1_"))
    .every(([, v]) => v === true);
  if (!ok || !results.v1_unchanged) {
    process.exitCode = 2;
    console.error("PROBE_FAILED");
    return;
  }
  console.log("PROBE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
