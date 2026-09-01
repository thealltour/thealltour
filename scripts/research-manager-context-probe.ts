#!/usr/bin/env npx tsx
/**
 * Read-only live probe for Marketing Manager research context.
 * Usage:
 *   npx tsx scripts/research-manager-context-probe.ts
 *   RESEARCH_USE_SUPABASE=true npx tsx scripts/research-manager-context-probe.ts
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
      // ignore
    }
  }
}

loadEnvIntoProcess();

async function main(): Promise<void> {
  const { getResearchContextTool } = await import("@/lib/marketing/bot/getResearchContextTool");
  const context = await getResearchContextTool({ limit: 10 });

  console.log(
    JSON.stringify(
      {
        contract: context.contract,
        status: context.status,
        candidateCount: context.agendaCandidates.length,
        briefCount: context.briefs.length,
        topScore: context.observability.topScore,
        degraded: context.observability.degraded,
        topTitles: context.agendaCandidates.slice(0, 5).map((c) => c.title),
        hasEvidence: context.agendaCandidates.every((c) => c.evidence.length > 0),
        hasScoreComponents: context.agendaCandidates.every((c) => Boolean(c.researchScoreComponents)),
        containsEmbeddingLeak: JSON.stringify(context).includes("embedding"),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[research-manager-context-probe] failed", error);
  process.exitCode = 1;
});
