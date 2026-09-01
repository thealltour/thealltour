#!/usr/bin/env npx tsx
/**
 * Bounded real research collection run (read-only).
 * Usage: RESEARCH_COLLECTION_ENABLED=true npx tsx scripts/research-collection-run.ts
 * Supabase: RESEARCH_USE_SUPABASE=true RESEARCH_COLLECTION_ENABLED=true npx tsx scripts/research-collection-run.ts
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as NodeModule;
} catch {
  // ignore
}

function loadEnvIntoProcess(): void {
  for (const file of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.env.HOME || "/home/ysh", ".hermes/.env"),
  ]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("=");
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {
      // ignore missing env files
    }
  }
}

loadEnvIntoProcess();

async function main(): Promise<void> {
  const { runResearchCollectionCycle } = await import(
    "@/lib/marketing/research/collection/runResearchCollectionCycle"
  );
  const { createResearchRepository } = await import(
    "@/lib/marketing/research/repository/createResearchRepository"
  );

  const useSupabase = process.env.RESEARCH_USE_SUPABASE?.trim().toLowerCase() === "true";
  const repo = await createResearchRepository({
    backend: useSupabase ? "supabase" : "memory",
  });
  const result = await runResearchCollectionCycle({
    repo,
    maxItemsPerCollector: 15,
    env: {
      ...process.env,
      RESEARCH_COLLECTION_ENABLED: process.env.RESEARCH_COLLECTION_ENABLED ?? "true",
    },
  });

  console.log(
    JSON.stringify(
      {
        cycleId: result.cycleId,
        status: result.status,
        totals: result.totals,
        collectors: result.collectorResults.map((r) => ({
          collectorId: r.collectorId,
          status: r.status,
          observed: r.itemsObserved,
          accepted: r.itemsAccepted,
          rejected: r.itemsRejected,
          errors: r.errors,
        })),
      },
      null,
      2,
    ),
  );

  if (result.pipeline?.enriched) {
    const sample = result.pipeline.enriched.slice(0, 8).map((signal) => ({
      title: signal.title,
      sourceType: signal.sourceType,
      publishedAt: signal.publishedAt,
      status: signal.status,
      freshness: signal.freshness?.freshnessScore,
      credibility: signal.credibility?.score,
      travelRelevance: signal.travelRelevance?.score,
      evidenceUrl: signal.evidence[0]?.url ?? signal.evidence[0]?.reference,
    }));
    console.log("\n--- spot-check sample ---");
    console.log(JSON.stringify(sample, null, 2));
  }
}

main().catch((error) => {
  console.error("[research-collection-run] failed", error);
  process.exitCode = 1;
});
