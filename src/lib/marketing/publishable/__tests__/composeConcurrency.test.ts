import { describe, expect, it } from "vitest";

import {
  PUBLISHABLE_COMPOSER_CONCURRENCY_DEFAULT,
  PUBLISHABLE_COMPOSER_CONCURRENCY_MAX,
  resolvePublishableComposerConcurrency,
  runWithConcurrency,
} from "@/lib/marketing/publishable/composeConcurrency";

describe("resolvePublishableComposerConcurrency", () => {
  it("defaults to 2 without configuration", () => {
    expect(resolvePublishableComposerConcurrency({})).toBe(
      PUBLISHABLE_COMPOSER_CONCURRENCY_DEFAULT,
    );
  });

  it("clamps to the ceiling and to at least 1", () => {
    expect(resolvePublishableComposerConcurrency({ MARKETING_COMPOSER_CONCURRENCY: "9" })).toBe(
      PUBLISHABLE_COMPOSER_CONCURRENCY_MAX,
    );
    expect(resolvePublishableComposerConcurrency({ MARKETING_COMPOSER_CONCURRENCY: "0" })).toBe(1);
  });

  it("ignores unparseable values", () => {
    expect(
      resolvePublishableComposerConcurrency({ MARKETING_COMPOSER_CONCURRENCY: "two" }),
    ).toBe(PUBLISHABLE_COMPOSER_CONCURRENCY_DEFAULT);
  });
});

describe("runWithConcurrency", () => {
  it("keeps results in input order regardless of completion order", async () => {
    const delays = [30, 0, 15, 5];
    const results = await runWithConcurrency(
      delays.map((ms, index) => async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return index;
      }),
      2,
    );
    expect(results).toEqual([0, 1, 2, 3]);
  });

  it("never exceeds the requested number of in-flight tasks", async () => {
    let inFlight = 0;
    let peak = 0;
    await runWithConcurrency(
      Array.from({ length: 6 }, () => async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return null;
      }),
      2,
    );
    expect(peak).toBe(2);
  });

  it("runs every task even when one rejects, then rethrows the first failure", async () => {
    const ran: number[] = [];
    await expect(
      runWithConcurrency(
        [
          async () => {
            ran.push(0);
            throw new Error("first");
          },
          async () => {
            ran.push(1);
            throw new Error("second");
          },
          async () => {
            ran.push(2);
            return null;
          },
        ],
        2,
      ),
    ).rejects.toThrow("first");
    expect(ran.sort()).toEqual([0, 1, 2]);
  });

  it("handles an empty task list", async () => {
    await expect(runWithConcurrency([], 2)).resolves.toEqual([]);
  });
});
