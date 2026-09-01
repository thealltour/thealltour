#!/usr/bin/env node
/**
 * API/security proof for marketing-review admin endpoints.
 *   npx tsx scripts/marketing-review-api-security-probe.ts
 */
import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();

const BASE = process.env.MARKETING_REVIEW_PROBE_BASE ?? "http://localhost:4000";
const CANDIDATE_ID = "cmc_step_3_8_verification";

async function probe(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { path, status: res.status, body: json };
}

async function main() {
  const unauthQueue = await probe("/api/admin/marketing-review");
  const unauthDetail = await probe(`/api/admin/marketing-review/${CANDIDATE_ID}`);
  const unauthApprove = await probe(`/api/admin/marketing-review/${CANDIDATE_ID}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ humanNotes: "probe" }),
  });

  const secretScan = JSON.stringify({ unauthQueue, unauthDetail, unauthApprove });
  const forbidden = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "service_role",
    "OPENROUTER",
    "embedding",
    "sk-",
  ].filter((token) => secretScan.includes(token));

  console.log(
    JSON.stringify(
      {
        base: BASE,
        unauthenticated: {
          queueStatus: unauthQueue.status,
          detailStatus: unauthDetail.status,
          approveStatus: unauthApprove.status,
          rejected: [unauthQueue.status, unauthDetail.status, unauthApprove.status].every((s) => s === 401 || s === 403),
        },
        forbiddenTokensInResponse: forbidden,
        publicationSafetyNote: "No SNS/Telegram endpoints probed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
