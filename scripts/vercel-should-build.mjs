#!/usr/bin/env node
/**
 * Vercel Ignored Build Step command.
 *
 * Semantics (Vercel):
 *   exit 0 → SKIP / cancel this deployment
 *   exit 1 → BUILD / continue deployment
 *
 * This inverts typical Unix "0 = success" for the ignore step.
 *
 * Multi-commit safety:
 *   Prefer VERCEL_GIT_PREVIOUS_SHA...VERCEL_GIT_COMMIT_SHA (or HEAD) so a push
 *   that contains both src/** and docs/** cannot false-skip when HEAD is docs-only.
 *   If previous SHA is unavailable / invalid → BUILD (never skip on uncertain git).
 *
 * Configure via vercel.json ignoreCommand (overrides dashboard):
 *   "ignoreCommand": "node scripts/vercel-should-build.mjs"
 *
 * Local dry-run:
 *   node scripts/vercel-should-build.mjs --base=<sha> --head=<sha>
 *   node scripts/vercel-should-build.mjs --paths=docs/a.md,src/app/page.tsx
 */

import { spawnSync } from "node:child_process";
import { decideFromChanges, decideFromPaths, parseNameStatus } from "./lib/vercelBuildRelevance.mjs";

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq < 0) {
      out[arg.slice(2)] = "true";
    } else {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return out;
}

function isSha(value) {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value.trim());
}

/**
 * @param {string[]} args
 * @returns {{ ok: true, stdout: string } | { ok: false, message: string }}
 */
function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    return { ok: false, message: result.error.message };
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    return { ok: false, message: err || `git ${args.join(" ")} exited ${result.status}` };
  }
  return { ok: true, stdout: result.stdout ?? "" };
}

function resolveRange(cli) {
  if (cli.paths) {
    return { mode: "paths", paths: cli.paths.split(",").map((p) => p.trim()).filter(Boolean) };
  }

  const head =
    (cli.head && cli.head.trim()) ||
    (process.env.VERCEL_GIT_COMMIT_SHA && process.env.VERCEL_GIT_COMMIT_SHA.trim()) ||
    "HEAD";

  const baseFromCli = cli.base && cli.base.trim();
  const baseFromEnv =
    process.env.VERCEL_GIT_PREVIOUS_SHA && process.env.VERCEL_GIT_PREVIOUS_SHA.trim();

  const base = baseFromCli || baseFromEnv || "";

  if (!base) {
    return {
      mode: "uncertain",
      reason: "missing_previous_sha",
      detail:
        "VERCEL_GIT_PREVIOUS_SHA / --base unavailable; refusing to use HEAD^ alone (multi-commit false-skip risk)",
    };
  }

  if (baseFromEnv && !baseFromCli && !isSha(baseFromEnv)) {
    return { mode: "uncertain", reason: "invalid_previous_sha", detail: "VERCEL_GIT_PREVIOUS_SHA not a SHA" };
  }

  // Ensure base is resolvable.
  const verify = runGit(["rev-parse", "--verify", `${base}^{commit}`]);
  if (!verify.ok) {
    return {
      mode: "uncertain",
      reason: "previous_sha_unresolvable",
      detail: verify.message,
    };
  }

  const verifyHead = runGit(["rev-parse", "--verify", `${head}^{commit}`]);
  if (!verifyHead.ok) {
    return { mode: "uncertain", reason: "head_unresolvable", detail: verifyHead.message };
  }

  return { mode: "range", base, head };
}

function printDecision(decision, extra = {}) {
  const lines = [
    `VERCEL_BUILD_DECISION=${decision.decision}`,
    `reason=${decision.reason}`,
  ];
  if (extra.base) lines.push(`base=${extra.base}`);
  if (extra.head) lines.push(`head=${extra.head}`);
  if (decision.matchedRelevant.length) {
    lines.push(`matched_relevant=${decision.matchedRelevant.slice(0, 12).join(",")}`);
  }
  if (decision.matchedUnknown.length) {
    lines.push(`matched_unknown=${decision.matchedUnknown.slice(0, 12).join(",")}`);
  }
  if (decision.matchedIrrelevant.length && decision.decision === "SKIP") {
    lines.push(`matched_irrelevant=${decision.matchedIrrelevant.slice(0, 20).join(",")}`);
  }
  console.log(lines.join("\n"));
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const range = resolveRange(cli);

  if (range.mode === "uncertain") {
    const decision = {
      decision: "BUILD",
      reason: "diff_unavailable",
      classes: {},
      matchedRelevant: [],
      matchedIrrelevant: [],
      matchedUnknown: [],
    };
    printDecision(decision);
    console.log(`detail=${range.reason}:${range.detail ?? ""}`);
    process.exit(1); // BUILD
  }

  if (range.mode === "paths") {
    const decision = decideFromPaths(range.paths);
    printDecision(decision);
    process.exit(decision.decision === "SKIP" ? 0 : 1);
  }

  // name-status with renames; -z for robust parsing
  const diff = runGit([
    "diff",
    "--name-status",
    "-z",
    "--find-renames",
    `${range.base}...${range.head}`,
  ]);

  // Three-dot may fail on unrelated histories; fall back to two-dot, then BUILD.
  let nameStatus = "";
  if (diff.ok) {
    nameStatus = diff.stdout;
  } else {
    const diff2 = runGit([
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      range.base,
      range.head,
    ]);
    if (!diff2.ok) {
      const decision = {
        decision: "BUILD",
        reason: "diff_unavailable",
        classes: {},
        matchedRelevant: [],
        matchedIrrelevant: [],
        matchedUnknown: [],
      };
      printDecision(decision, { base: range.base, head: range.head });
      console.log(`detail=${diff2.message}`);
      process.exit(1);
    }
    nameStatus = diff2.stdout;
  }

  const changes = parseNameStatus(nameStatus);
  if (changes.length === 0) {
    // Empty diff between previous successful deploy and HEAD → skip is reasonable,
    // but be conservative if git returned empty unexpectedly: SKIP only when range ok.
    const decision = {
      decision: "SKIP",
      reason: "only_web_irrelevant_changes",
      classes: {},
      matchedRelevant: [],
      matchedIrrelevant: [],
      matchedUnknown: [],
    };
    // Actually empty = no file changes → SKIP is correct for ignore step.
    printDecision(
      { ...decision, reason: "no_file_changes_in_range" },
      { base: range.base, head: range.head },
    );
    process.exit(0);
  }

  const decision = decideFromChanges(changes);
  printDecision(decision, { base: range.base, head: range.head });
  process.exit(decision.decision === "SKIP" ? 0 : 1);
}

main();
