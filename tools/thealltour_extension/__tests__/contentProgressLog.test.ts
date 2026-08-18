import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type ProgressLogTestHooks = {
  resetProgressLog: () => void;
  logStep: (label: string, pct?: number) => string;
  logNote: (text: string) => string;
  getEntries: () => string[];
};

function loadContentScript(): ProgressLogTestHooks {
  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      id: "test-extension-id",
      onMessage: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
  };
  runInThisContext(readFileSync(path.join(extDir, "content.js"), "utf8"), {
    filename: "content.js",
  });
  const hooks = (globalThis as { __theallTourProgressLogTestHooks?: ProgressLogTestHooks })
    .__theallTourProgressLogTestHooks;
  if (!hooks?.logStep) {
    throw new Error("__theallTourProgressLogTestHooks.logStep was not exported");
  }
  return hooks;
}

describe("content.js progress log (logStep/logNote)", () => {
  it("formats each entry with delta/total elapsed time and the reported percent", () => {
    const { resetProgressLog, logStep, getEntries } = loadContentScript();
    resetProgressLog();

    logStep("준비 중…", 5);
    logStep("부모 탭 출발일·가격 수집…", 38);

    const entries = getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatch(/^\[\+\d+\.\ds\] 준비 중… \(총 \d+\.\ds · 5%\)$/);
    expect(entries[1]).toMatch(/^\[\+\d+\.\ds\] 부모 탭 출발일·가격 수집… \(총 \d+\.\ds · 38%\)$/);
  });

  it("logNote inserts a note between checkpoints without changing the last reported percent", () => {
    const { resetProgressLog, logStep, logNote, getEntries } = loadContentScript();
    resetProgressLog();

    logStep("부모 탭 출발일·가격 수집…", 38);
    logNote("부모 탭 순회 완료 (source=parent_tab_browse, 12건)");

    const entries = getEntries();
    expect(entries).toHaveLength(2);
    // logNote must keep reporting the last known percent (38%), not reset it to 0.
    expect(entries[1]).toContain("38%");
    expect(entries[1]).toContain("부모 탭 순회 완료");
  });

  it("caps stored entries so a long-running collection cannot grow the log unbounded", () => {
    const { resetProgressLog, logStep, getEntries } = loadContentScript();
    resetProgressLog();

    for (let i = 0; i < 100; i += 1) {
      logStep(`step ${i}`, 10);
    }

    expect(getEntries().length).toBeLessThanOrEqual(60);
  });
});
