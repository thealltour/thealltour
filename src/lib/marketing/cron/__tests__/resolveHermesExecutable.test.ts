import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

import { resolveHermesExecutable } from "../resolveHermesExecutable";

describe("resolveHermesExecutable", () => {
  it("prefers HERMES_BIN when set", () => {
    expect(resolveHermesExecutable({ HERMES_BIN: "/custom/hermes" })).toBe("/custom/hermes");
  });

  it("falls back to known Pi paths or hermes", () => {
    const resolved = resolveHermesExecutable({});
    if (existsSync("/home/ysh/.local/bin/hermes")) {
      expect(resolved).toBe("/home/ysh/.local/bin/hermes");
    } else if (existsSync("/home/ysh/.hermes/hermes-agent/venv/bin/hermes")) {
      expect(resolved).toBe("/home/ysh/.hermes/hermes-agent/venv/bin/hermes");
    } else {
      expect(resolved).toBe("hermes");
    }
  });
});
