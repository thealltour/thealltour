import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type RequestParentCalendarResponse = {
  ok: boolean;
  error?: string;
  triedTabIds?: number[];
};

type HanatourCrossTabCalendarApi = {
  requestParentCalendarViaBackground: (
    productCodes: { saleProdCd?: string | null; rprsProdCd?: string | null; depDay?: string | null },
    options?: { browseMonths?: number },
  ) => Promise<RequestParentCalendarResponse>;
  REQUEST_PARENT_CALENDAR_TIMEOUT_MS: number;
};

function loadCrossTabModule(): HanatourCrossTabCalendarApi {
  runInThisContext(readFileSync(path.join(extDir, "hanatourCrossTabCalendar.js"), "utf8"), {
    filename: "hanatourCrossTabCalendar.js",
  });
  const api = (globalThis as { HanatourCrossTabCalendar?: HanatourCrossTabCalendarApi })
    .HanatourCrossTabCalendar;
  if (!api?.requestParentCalendarViaBackground) {
    throw new Error(
      "HanatourCrossTabCalendar.requestParentCalendarViaBackground was not exported",
    );
  }
  return api;
}

describe("requestParentCalendarViaBackground timeout safety net", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it("resolves with a timeout error instead of hanging forever when the background never responds", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: {
        // Simulates a dead/unresponsive service worker: the callback is never invoked.
        sendMessage: () => {},
      },
    };

    const { requestParentCalendarViaBackground, REQUEST_PARENT_CALENDAR_TIMEOUT_MS } =
      loadCrossTabModule();

    // Generous, minutes-scale safety net — never meant to cut off legitimate collection.
    expect(REQUEST_PARENT_CALENDAR_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);

    const resultPromise = requestParentCalendarViaBackground(
      { saleProdCd: "ABC", rprsProdCd: null, depDay: null },
      { browseMonths: 12 },
    );

    await vi.advanceTimersByTimeAsync(REQUEST_PARENT_CALENDAR_TIMEOUT_MS + 1000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("resolves normally when the background responds well before the timeout", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: {
        sendMessage: (
          _message: unknown,
          callback: (response: RequestParentCalendarResponse) => void,
        ) => {
          callback({ ok: true });
        },
      },
    };

    const { requestParentCalendarViaBackground } = loadCrossTabModule();

    const result = await requestParentCalendarViaBackground(
      { saleProdCd: "ABC", rprsProdCd: null, depDay: null },
      { browseMonths: 12 },
    );

    expect(result.ok).toBe(true);
  });
});
