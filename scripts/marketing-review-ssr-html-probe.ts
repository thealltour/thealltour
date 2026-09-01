#!/usr/bin/env node
/**
 * SSR HTML proof for marketing-review pages using a minted settings.manage session.
 */
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

function includesAll(html: string, needles: string[]) {
  return needles.map((needle) => ({ needle, found: html.includes(needle) }));
}

async function main() {
  const { mintVerificationAdminSession } = await import("./marketing-review-verification-session");
  const { cookieHeader } = await mintVerificationAdminSession("bootstrap");

  const queueRes = await fetch(`${BASE}/theall_manager_only/marketing-review`, {
    headers: { cookie: cookieHeader },
  });
  const detailRes = await fetch(`${BASE}/theall_manager_only/marketing-review/${CANDIDATE_ID}`, {
    headers: { cookie: cookieHeader },
  });
  const queueHtml = await queueRes.text();
  const detailHtml = await detailRes.text();

  console.log(
    JSON.stringify(
      {
        queueStatus: queueRes.status,
        detailStatus: detailRes.status,
        queueChecks: includesAll(queueHtml, [
          "Human Review Queue",
          "[VERIFICATION] Japan autumn travel update",
          "ready_for_human_review",
          "approved_for_manual_publish",
          "ALLOW",
        ]),
        detailChecks: includesAll(detailHtml, [
          "[VERIFICATION] Japan autumn travel update",
          "A. 오늘의 아젠다",
          "MM rationale",
          "C. 근거 / 출처",
          "D. 콘텐츠 플랜",
          "Original AI draft",
          "F. 거버넌스",
          "수동 게시 준비 승인",
          "SNS/API 게시",
          "거버넌스 검토 이후 편집",
          "approved_for_manual_publish",
        ]),
        permissionDeniedOnQueue: queueHtml.includes("You do not have permission"),
        permissionDeniedOnDetail: detailHtml.includes("You do not have permission"),
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
