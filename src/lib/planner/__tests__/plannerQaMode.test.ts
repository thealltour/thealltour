import { describe, expect, it } from "vitest";
import { isPlannerQaModeEnabled } from "@/lib/planner/qaMode";

describe("isPlannerQaModeEnabled", () => {
  it("returns false when undefined", () => {
    expect(isPlannerQaModeEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("returns false when PLANNER_QA_MODE is false", () => {
    expect(
      isPlannerQaModeEnabled({
        NODE_ENV: "development",
        PLANNER_QA_MODE: "false",
      }),
    ).toBe(false);
  });

  it("returns true in development when PLANNER_QA_MODE=true", () => {
    expect(
      isPlannerQaModeEnabled({
        NODE_ENV: "development",
        PLANNER_QA_MODE: "true",
      }),
    ).toBe(true);
  });

  it("returns true in preview when PLANNER_QA_MODE=true", () => {
    expect(
      isPlannerQaModeEnabled({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        PLANNER_QA_MODE: "1",
      }),
    ).toBe(true);
  });

  it("hard-blocks Vercel production even when env true", () => {
    expect(
      isPlannerQaModeEnabled({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        PLANNER_QA_MODE: "true",
      }),
    ).toBe(false);
  });

  it("hard-blocks NODE_ENV production outside preview", () => {
    expect(
      isPlannerQaModeEnabled({
        NODE_ENV: "production",
        PLANNER_QA_MODE: "true",
      }),
    ).toBe(false);
  });
});
