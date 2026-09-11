import { describe, expect, it } from "vitest";

import {
  CANONICAL_PATH_DOCUMENTED_FORBIDDEN_MARKER,
  findCanonicalPathViolationsInText,
} from "@/lib/repoHygiene/canonicalPathGuard";

/** Split so the repo-wide path scanner does not treat this test file as a violation. */
const FORBIDDEN_ABS = ["/home/ysh/", "theallcloud"].join("");
const FORBIDDEN_TILDE = ["~/", "theallcloud"].join("");

describe("canonicalPathGuard", () => {
  it("fails on cd absolute forbidden path", () => {
    const v = findCanonicalPathViolationsInText(`cd ${FORBIDDEN_ABS}\n`);
    expect(v).toHaveLength(1);
    expect(v[0]?.match).toBe(FORBIDDEN_ABS);
  });

  it("fails on quoted cd path", () => {
    const v = findCanonicalPathViolationsInText(`cd "${FORBIDDEN_ABS}"\n`);
    expect(v.some((x) => x.match === FORBIDDEN_ABS)).toBe(true);
  });

  it("fails on WorkingDirectory forbidden path", () => {
    const v = findCanonicalPathViolationsInText(`WorkingDirectory=${FORBIDDEN_ABS}\n`);
    expect(v).toHaveLength(1);
  });

  it("fails on tilde forbidden path", () => {
    const v = findCanonicalPathViolationsInText(`export ROOT=${FORBIDDEN_TILDE}\n`);
    expect(v).toHaveLength(1);
    expect(v[0]?.match).toBe(FORBIDDEN_TILDE);
  });

  it("passes on /home/ysh/thealltour", () => {
    expect(
      findCanonicalPathViolationsInText("WorkingDirectory=/home/ysh/thealltour\n"),
    ).toHaveLength(0);
  });

  it("passes on ORCHESTRATION_PROJECT_ID=theallcloud", () => {
    expect(
      findCanonicalPathViolationsInText('ORCHESTRATION_PROJECT_ID="theallcloud"\n'),
    ).toHaveLength(0);
  });

  it("passes on theallcloud-marketing", () => {
    expect(
      findCanonicalPathViolationsInText("server: theallcloud-marketing\n"),
    ).toHaveLength(0);
  });

  it("passes on embedding and workspace paths", () => {
    const text = [
      "/home/ysh/thealltour-ai-inference",
      "/home/ysh/.cache/thealltour-shortform/",
      "/mnt/HDD2TB/marketing-assets",
    ].join("\n");
    expect(findCanonicalPathViolationsInText(text)).toHaveLength(0);
  });

  it("skips documented forbidden examples with marker", () => {
    const line = `${FORBIDDEN_ABS} ${CANONICAL_PATH_DOCUMENTED_FORBIDDEN_MARKER}`;
    expect(findCanonicalPathViolationsInText(`${line}\n`)).toHaveLength(0);
  });
});
