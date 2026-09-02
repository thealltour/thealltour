#!/usr/bin/env node
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();

const BASE = process.env.MARKETING_REVIEW_PROBE_BASE ?? "http://localhost:4000";
const CANDIDATE_ID = "cmc_step_3_8_verification";

function scanSecrets(payload: unknown) {
  const scan = JSON.stringify(payload);
  return ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "OPENROUTER", "embedding", "sk-"].filter((t) =>
    scan.includes(t),
  );
}

type MintVerificationAdminSession = (
  profile: "bootstrap" | "manager",
) => Promise<{ cookieHeader: string }>;

async function resolveAuthorizedCookie(
  mintVerificationAdminSession: MintVerificationAdminSession,
): Promise<{ cookie: string; mode: "login" | "minted_bootstrap" }> {
  const id = process.env.ADMIN_ID?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (id && password) {
    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password, next: "/theall_manager_only/marketing-review" }),
    });
    const setCookie = login.headers.get("set-cookie") ?? "";
    if (login.ok && setCookie) {
      return { cookie: setCookie.split(";")[0], mode: "login" };
    }
  }

  const minted = await mintVerificationAdminSession("bootstrap");
  return { cookie: minted.cookieHeader, mode: "minted_bootstrap" };
}

async function main() {
  const { mintVerificationAdminSession } = await import("./marketing-review-verification-session");
  const unauthorized = await mintVerificationAdminSession("manager");
  const unauthQueue = await fetch(`${BASE}/api/admin/marketing-review?filter=all`, {
    headers: { cookie: unauthorized.cookieHeader },
  });
  const unauthApprove = await fetch(`${BASE}/api/admin/marketing-review/${CANDIDATE_ID}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: unauthorized.cookieHeader },
    body: JSON.stringify({ humanNotes: "probe unauthorized" }),
  });

  const { cookie, mode } = await resolveAuthorizedCookie(mintVerificationAdminSession);
  const queue = await fetch(`${BASE}/api/admin/marketing-review?filter=all`, { headers: { cookie } });
  const detail = await fetch(`${BASE}/api/admin/marketing-review/${CANDIDATE_ID}`, { headers: { cookie } });
  const queueJson = await queue.json();
  const detailJson = await detail.json();
  const forbidden = scanSecrets({ queueJson, detailJson });

  console.log(
    JSON.stringify(
      {
        authMode: mode,
        unauthorized: {
          queueStatus: unauthQueue.status,
          approveStatus: unauthApprove.status,
          rejected: unauthQueue.status === 403 && unauthApprove.status === 403,
        },
        authorized: {
          queueStatus: queue.status,
          detailStatus: detail.status,
          candidateVisible:
            Array.isArray(queueJson.items) &&
            queueJson.items.some((item: { candidateId: string }) => item.candidateId === CANDIDATE_ID),
          detailReviewStatus: detailJson.review?.status ?? null,
          detailCandidateStatus: detailJson.candidate?.status ?? null,
          detailGovernanceDecision: detailJson.candidate?.governanceDecision?.decision ?? null,
          detailGovernanceStale: detailJson.governanceStale ?? null,
          detailCanMarkManuallyPublished: detailJson.canMarkManuallyPublished ?? null,
          forbiddenTokensInResponse: forbidden,
        },
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
