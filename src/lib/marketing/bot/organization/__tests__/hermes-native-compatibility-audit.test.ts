import { describe, expect, it } from "vitest";

import {
  HERMES_HANDOFF_CLASSIFICATION,
  HERMES_HANDOFF_PRIMITIVES,
  buildHermesOneshotArgv,
  buildHermesQueryFileArgv,
} from "@/lib/marketing/bot/organization/hermesHandoff";
import { MAX_AUTO_REVISION_ROUNDS } from "@/lib/marketing/bot/organization/envelope";
import {
  DEFAULT_HERMES_INVOKE_TIMEOUT_MS,
  MAX_ORCHESTRATION_DEPTH,
  MAX_SPECIALIST_DISPATCHES_PER_REQUEST,
} from "@/lib/marketing/bot/organization/hermesRuntime";

/**
 * STEP 2-5.4C0 — audit lock only.
 * Ensures department handoff remains application-level oneshot (not Bot Chat message_agent)
 * until an explicit migration STEP decides otherwise.
 */
describe("STEP 2-5.4C0 Hermes native compatibility audit locks", () => {
  it("classifies handoff as application_level (not native message_agent)", () => {
    expect(HERMES_HANDOFF_CLASSIFICATION).toBe("application_level");
    expect(HERMES_HANDOFF_PRIMITIVES.oneshot).toContain("-z");
    expect(HERMES_HANDOFF_PRIMITIVES.botChat).toContain("Bot Chat");
  });

  it("oneshot argv does not open canonical Bot Chat", () => {
    const argv = buildHermesOneshotArgv("content-strategist", "probe");
    expect(argv).toEqual([
      "hermes",
      "-p",
      "content-strategist",
      "--yolo",
      "--ignore-rules",
      "-z",
      "probe",
    ]);
    expect(argv).not.toContain("chat");
    expect(argv).not.toContain("Bot Chat");
  });

  it("Bot Chat query-file helper exists but is a separate primitive", () => {
    const argv = buildHermesQueryFileArgv("governance-auditor", "/tmp/q.txt");
    expect(argv).toContain("chat");
    expect(argv).toContain("Bot Chat");
    expect(argv).toContain("--query-file");
  });

  it("keeps department fan-out / revision budgets stable for audit baseline", () => {
    expect(MAX_SPECIALIST_DISPATCHES_PER_REQUEST).toBe(4);
    expect(MAX_ORCHESTRATION_DEPTH).toBe(1);
    expect(MAX_AUTO_REVISION_ROUNDS).toBe(1);
    expect(DEFAULT_HERMES_INVOKE_TIMEOUT_MS).toBe(90_000);
  });
});
