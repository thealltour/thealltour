/**
 * Read-only shadow calibration against real daily_marketing_agenda_slates.
 * No production writes. No LLM. No paid APIs.
 *
 * Usage: npx tsx scripts/run-agenda-quality-v2-calibration.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import {
  formatCalibrationMarkdown,
  runAgendaQualityV2Calibration,
} from "@/lib/marketing/agendaQualityV2/calibration/runCalibration";
import { createInMemoryDurableAgendaReservoir } from "@/lib/marketing/agendaQualityV2/reservoir/types";

async function loadSlates(from: string, to: string): Promise<DailyAgendaSlate[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env missing — cannot load persisted slates");
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("daily_marketing_agenda_slates")
    .select("business_date_kst, updated_at, payload")
    .gte("business_date_kst", from)
    .lte("business_date_kst", to)
    .order("business_date_kst", { ascending: true });
  if (error) throw new Error(error.message);

  const byDate = new Map<string, { updated_at: string; payload: DailyAgendaSlate }>();
  for (const row of data ?? []) {
    const d = row.business_date_kst as string;
    const prev = byDate.get(d);
    if (!prev || String(row.updated_at) > String(prev.updated_at)) {
      byDate.set(d, {
        updated_at: String(row.updated_at),
        payload: row.payload as DailyAgendaSlate,
      });
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v.payload);
}

async function main() {
  const from = "2026-09-08";
  const to = "2026-09-16";
  const slates = await loadSlates(from, to);
  if (slates.length === 0) {
    throw new Error("No persisted slates in range");
  }

  const report = await runAgendaQualityV2Calibration({
    days: slates.map((slate) => ({
      businessDateKst: slate.businessDateKst,
      slate,
    })),
    reservoir: createInMemoryDurableAgendaReservoir(),
  });

  const outDir = path.join(process.cwd(), "artifacts", "agenda-quality-v2");
  await fs.mkdir(outDir, { recursive: true });
  const stem = `calibration-${from}_${to}`;
  const jsonPath = path.join(outDir, `${stem}.json`);
  const mdPath = path.join(outDir, `${stem}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(mdPath, formatCalibrationMarkdown(report), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        days: slates.length,
        jsonPath,
        mdPath,
        readiness: report.productionReadiness.classification,
        dailySlateCounts: report.totals.dailySlateCounts,
        llmExternalCalls: report.llmExternalCalls,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
