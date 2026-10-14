#!/usr/bin/env node
/**
 * Compare, back up and sync SOUL.md of the shared-visual-planner / astra-handoff-writer Hermes profiles with the
 * source-controlled constants. Runs no Hermes task and generates no content. Only SOUL.md is ever written;
 * config.yaml and profile.yaml are never created or changed.
 *
 *   npx tsx scripts/sync-hermes-visual-profile-souls.ts            # read-only: status + sha256 (default)
 *   npx tsx scripts/sync-hermes-visual-profile-souls.ts --diff     # read-only: unified diff current -> code
 *   npx tsx scripts/sync-hermes-visual-profile-souls.ts --apply    # backup SOUL.md, write code SOUL, verify
 *
 * Exit codes: 0 in sync (or applied and verified), 1 out of sync (check/diff), 2 profile or SOUL.md missing, 3 verify failed.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, constants, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASTRA_HANDOFF_WRITER_HERMES_PROFILE, ASTRA_HANDOFF_WRITER_SOUL, SHARED_VISUAL_PLANNER_HERMES_PROFILE, SHARED_VISUAL_PLANNER_SOUL,
} from "../src/lib/marketing/publishable/visualOrchestration/hermesIdentity";

const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--diff") ? "diff" : "check";
const hermesHome = process.env.HERMES_HOME ?? "/home/ysh/.hermes";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
const profiles = [
  { profile: SHARED_VISUAL_PLANNER_HERMES_PROFILE, soul: SHARED_VISUAL_PLANNER_SOUL },
  { profile: ASTRA_HANDOFF_WRITER_HERMES_PROFILE, soul: ASTRA_HANDOFF_WRITER_SOUL },
];
let exitCode = 0;
for (const { profile, soul } of profiles) {
  const soulPath = join(hermesHome, "profiles", profile, "SOUL.md");
  const expected = soul.trim() + "\n";
  if (!existsSync(soulPath)) { console.log(`${profile}: SOUL.md 없음 (${soulPath}) · 프로필 생성은 이 스크립트가 하지 않습니다.`); exitCode = Math.max(exitCode, 2); continue; }
  const current = readFileSync(soulPath, "utf8");
  const same = current === expected;
  console.log(`${profile}: ${same ? "일치" : "불일치"} · current sha256 ${sha(current)} (${current.split("\n").length}줄) · code sha256 ${sha(expected)} (${expected.split("\n").length}줄)`);
  if (same) continue;
  if (mode === "check") { exitCode = Math.max(exitCode, 1); continue; }
  if (mode === "diff") {
    const diff = spawnSync("diff", ["-u", "--label", `${profile}/SOUL.md (current)`, "--label", `${profile}/SOUL.md (code)`, soulPath, "-"], { input: expected, encoding: "utf8" });
    process.stdout.write(diff.stdout); exitCode = Math.max(exitCode, 1); continue;
  }
  const backup = `${soulPath}.before-sync-${stamp}`;
  copyFileSync(soulPath, backup, constants.COPYFILE_EXCL);
  const temporary = `${soulPath}.sync-${process.pid}.tmp`;
  writeFileSync(temporary, expected, { encoding: "utf8", mode: statSync(soulPath).mode & 0o777 });
  renameSync(temporary, soulPath);
  const written = readFileSync(soulPath, "utf8");
  if (written !== expected) { console.log(`${profile}: 검증 실패 · 백업 ${backup}`); exitCode = 3; continue; }
  console.log(`${profile}: 동기화 완료 · 백업 ${backup}\n  확인: diff -u ${backup} ${soulPath}`);
}
process.exit(exitCode);
