vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { createHash } from "node:crypto";

import { createContentAssignment } from "@/lib/marketing/content/createContentAssignment";
import { createSelectedAgenda } from "@/lib/marketing/content/createSelectedAgenda";
import { buildStablePrefixedId } from "@/lib/marketing/content/stablePrefixedId";

const NOW = new Date("2026-09-04T00:00:00.000Z");

describe("stablePrefixedId collision fix", () => {
  it("hashes full logical key instead of truncating date-bearing prefixes", () => {
    const keyA = "daily-marketing-plan:2026-09-03";
    const keyB = "daily-marketing-plan:2026-09-04";
    // Old bug: both slice(0,24) to the same "daily-marketing-plan:202"
    expect(keyA.slice(0, 24)).toBe(keyB.slice(0, 24));
    expect(buildStablePrefixedId("sa", keyA)).not.toBe(buildStablePrefixedId("sa", keyB));
    expect(buildStablePrefixedId("ca", keyA)).not.toBe(buildStablePrefixedId("ca", keyB));
  });

  it("same logicalRunKey remains deterministic", () => {
    const key = "daily-marketing-plan:2026-09-04";
    expect(buildStablePrefixedId("sa", key)).toBe(buildStablePrefixedId("sa", key));
    const expected = `sa_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
    expect(buildStablePrefixedId("sa", key)).toBe(expected);
  });

  it("createSelectedAgenda / createContentAssignment use hash-backed ids", () => {
    const keyA = "daily-marketing-plan:2026-09-03";
    const keyB = "daily-marketing-plan:2026-09-04";
    const agendaA = createSelectedAgenda({
      title: "A",
      summary: "Summary A",
      idempotencyKey: keyA,
      now: NOW,
    });
    const agendaB = createSelectedAgenda({
      title: "B",
      summary: "Summary B",
      idempotencyKey: keyB,
      now: NOW,
    });
    expect(agendaA.id).not.toBe(agendaB.id);
    expect(agendaA.id).toBe(buildStablePrefixedId("sa", keyA));

    const caA = createContentAssignment({ selectedAgenda: agendaA, idempotencyKey: keyA, now: NOW });
    const caB = createContentAssignment({ selectedAgenda: agendaB, idempotencyKey: keyB, now: NOW });
    expect(caA.assignmentId).not.toBe(caB.assignmentId);
    expect(caA.assignmentId).toBe(buildStablePrefixedId("ca", keyA));
  });
});
