#!/usr/bin/env npx tsx
/**
 * Reproducible Desktop MCP include alignment from skillMatrix SoT.
 *
 * Does NOT commit secrets. Does NOT create profiles. Does NOT rewrite auth headers.
 * Only updates `mcp_servers.thealltour-marketing.tools.include` in existing
 * ~/.hermes/profiles/<role>/config.yaml files.
 *
 * Usage:
 *   npx tsx scripts/apply-hermes-marketing-mcp-includes.ts --print
 *   npx tsx scripts/apply-hermes-marketing-mcp-includes.ts --apply
 *   npx tsx scripts/apply-hermes-marketing-mcp-includes.ts --check
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  desktopExposedToolsForRole,
} from "@/lib/marketing/bot/organization/skillMatrix";
import type { MarketingAgentRole } from "@/lib/marketing/bot/organization/types";

const PROFILE_BY_ROLE: Record<MarketingAgentRole, string> = {
  marketing_manager: "marketing-manager",
  content_strategist: "content-strategist",
  governance_auditor: "governance-auditor",
  performance_analyst: "performance-analyst",
};

const ROLES = Object.keys(PROFILE_BY_ROLE) as MarketingAgentRole[];

function expectedIncludes(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const role of ROLES) {
    out[PROFILE_BY_ROLE[role]] = desktopExposedToolsForRole(role);
  }
  return out;
}

function profileConfigPath(profileDir: string): string {
  return path.join(os.homedir(), ".hermes", "profiles", profileDir, "config.yaml");
}

function readInclude(configPath: string): string[] | null {
  if (!existsSync(configPath)) return null;
  const text = readFileSync(configPath, "utf8");
  const lines = text.split(/\r?\n/);
  const include: string[] = [];
  let inInclude = false;
  for (const line of lines) {
    if (line.trim() === "include:") {
      inInclude = true;
      continue;
    }
    if (inInclude) {
      const m = line.match(/^\s+-\s+([A-Za-z0-9_]+)\s*$/);
      if (m) {
        include.push(m[1]!);
        continue;
      }
      // left the include list
      if (line.trim() !== "" && !line.trim().startsWith("#")) break;
    }
  }
  return include;
}

function applyInclude(configPath: string, tools: string[]): void {
  const text = readFileSync(configPath, "utf8");
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  let replaced = false;
  while (i < lines.length) {
    const line = lines[i]!;
    out.push(line);
    if (line.trim() === "include:") {
      i += 1;
      while (i < lines.length && /^\s+-\s+/.test(lines[i]!)) i += 1;
      const indent = "      ";
      for (const tool of tools) out.push(`${indent}- ${tool}`);
      replaced = true;
      continue;
    }
    i += 1;
  }
  if (!replaced) {
    throw new Error(`tools.include block not found in ${configPath}`);
  }
  writeFileSync(configPath, out.join("\n") + (text.endsWith("\n") ? "\n" : ""), "utf8");
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function main() {
  const mode = process.argv.includes("--apply")
    ? "apply"
    : process.argv.includes("--check")
      ? "check"
      : "print";

  const expected = expectedIncludes();

  if (mode === "print") {
    console.log(JSON.stringify({ source: "desktopExposedToolsForRole", expected }, null, 2));
    return;
  }

  let ok = true;
  for (const [profile, tools] of Object.entries(expected)) {
    const configPath = profileConfigPath(profile);
    const current = readInclude(configPath);
    if (!current) {
      console.log(JSON.stringify({ profile, status: "missing_profile", path: configPath }));
      ok = false;
      continue;
    }
    const match = sameList(current, tools);
    if (mode === "check") {
      console.log(
        JSON.stringify({
          profile,
          status: match ? "ok" : "drift",
          currentCount: current.length,
          expectedCount: tools.length,
          missing: tools.filter((t) => !current.includes(t)),
          unexpected: current.filter((t) => !tools.includes(t)),
        }),
      );
      if (!match) ok = false;
      continue;
    }
    // apply
    if (match) {
      console.log(JSON.stringify({ profile, status: "unchanged", count: tools.length }));
      continue;
    }
    applyInclude(configPath, tools);
    const after = readInclude(configPath);
    console.log(
      JSON.stringify({
        profile,
        status: "updated",
        count: tools.length,
        match: after ? sameList(after, tools) : false,
      }),
    );
  }

  if (mode === "check" && !ok) process.exit(2);
}

// Ensure tsx path aliases resolve for this script's imports.
const require = createRequire(import.meta.url);
void require;

main();
