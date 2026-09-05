import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../../../");
const script = path.join(repoRoot, "scripts/process-marketing-production-queue.ts");

function runDryRun() {
  return spawnSync(
    "npx",
    ["tsx", script, "--dry-run", "--max-batch", "1", "--backend", "memory"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes" },
      timeout: 120_000,
    },
  );
}

describe("G7-F2 production queue CLI server-only compatibility", () => {
  it(
    "13-14: boots under tsx; dry-run non-mutating; max-batch honored",
    () => {
      const result = runDryRun();
      const combined = `${result.stderr || ""}\n${result.stdout || ""}`;
      if (result.status !== 0) {
        expect(combined.slice(0, 2000)).not.toMatch(/server-only/);
      }
      expect(result.status, combined.slice(0, 2000)).toBe(0);
      expect(result.stdout).toContain("dryRun: true");
      expect(result.stdout).toContain("maxBatch: 1");
      expect(result.stdout).toContain("Claimable (no mutations)");
      expect(result.stdout).toContain('"dryRun": true');
      expect(result.stdout).toMatch(/claimableCount/);
      expect(result.stdout).not.toContain('"outcome": "completed"');
      expect(result.stdout).not.toContain('"outcome": "failed"');
    },
    120_000,
  );
});
