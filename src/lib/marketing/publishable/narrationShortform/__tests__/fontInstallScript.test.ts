import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { captionFontPath, SHORTFORM_LAYOUT_POLICY } from "../layoutPolicy";

const script = join(process.cwd(), "scripts/install-narration-caption-bold-font.py");
const run = (args: string[]) => new Promise<{ code: number; out: string }>(resolve => {
  const env = { ...process.env }; delete env.NARRATION_SHORTFORM_BOLD_FONT_FILE;
  execFile("python3", [script, ...args], { env, timeout: 60_000 }, (error, stdout, stderr) => resolve({ code: error ? (typeof error.code === "number" ? error.code : 99) : 0, out: stdout + stderr }));
});

describe("caption font install script", () => {
  let dir = ""; let server: Server; let base = ""; let requests = 0; const font = readFileSync(captionFontPath());
  beforeAll(async () => {
    expect(sha256Buffer(font)).toBe(SHORTFORM_LAYOUT_POLICY.font.sha256);
    dir = mkdtempSync(join(tmpdir(), "font-install-"));
    server = createServer((req, res) => { requests++;
      if (req.url === "/good.otf") { res.end(font); return; }
      if (req.url === "/tampered.otf") { const copy = Buffer.from(font); copy[copy.length - 10]! ^= 0xff; res.end(copy); return; }
      res.statusCode = 404; res.end("missing"); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });
  afterAll(async () => { await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  const leftovers = (target: string) => readdirSync(target).filter(name => name.endsWith(".part"));

  it("installs, re-runs without downloading, and reports through --check", async () => {
    const target = join(dir, "fresh"); const file = join(target, SHORTFORM_LAYOUT_POLICY.font.file);
    expect((await run(["--check", "--target-dir", target])).code).toBe(1);
    const first = await run(["--target-dir", target, "--source-url", `${base}/good.otf`]);
    expect(first.code, first.out).toBe(0); expect(sha256Buffer(readFileSync(file))).toBe(SHORTFORM_LAYOUT_POLICY.font.sha256);
    expect(JSON.parse(readFileSync(join(target, "source-bold.json"), "utf8")).sha256).toBe(SHORTFORM_LAYOUT_POLICY.font.sha256);
    expect(statSync(file).mode & 0o777).toBe(0o644); expect(leftovers(target)).toEqual([]);
    const mtime = statSync(file).mtimeMs; const before = requests;
    const again = await run(["--target-dir", target, "--source-url", `${base}/missing.otf`]);
    expect(again.code, again.out).toBe(0); expect(again.out).toContain("already installed"); expect(requests).toBe(before); expect(statSync(file).mtimeMs).toBe(mtime);
    const ok = await run(["--check", "--target-dir", target]); expect(ok.code, ok.out).toBe(0); expect(ok.out).toContain("readable as");
    if (process.getuid?.() !== 0) {
      chmodSync(file, 0o000); const denied = await run(["--check", "--target-dir", target]); chmodSync(file, 0o644);
      expect(denied.code).toBe(1); expect(denied.out).toContain("읽기 권한");
    }
  });

  it("keeps the existing file on a hash mismatch or a failed download", async () => {
    const target = join(dir, "stale"); const file = join(target, SHORTFORM_LAYOUT_POLICY.font.file);
    const seeded = await run(["--target-dir", target, "--source-url", `${base}/missing.otf`]); expect(seeded.code).toBe(2); expect(existsSync(file)).toBe(false); expect(leftovers(target)).toEqual([]);
    writeFileSync(file, "previous font bytes");
    const mismatch = await run(["--target-dir", target, "--source-url", `${base}/tampered.otf`]);
    expect(mismatch.code, mismatch.out).toBe(3); expect(mismatch.out).toContain("does not match the pin"); expect(readFileSync(file, "utf8")).toBe("previous font bytes"); expect(leftovers(target)).toEqual([]);
    const missing = await run(["--target-dir", target, "--source-url", `${base}/missing.otf`]);
    expect(missing.code, missing.out).toBe(2); expect(missing.out).toContain("404"); expect(readFileSync(file, "utf8")).toBe("previous font bytes"); expect(leftovers(target)).toEqual([]);
    const check = await run(["--check", "--target-dir", target]); expect(check.code).toBe(1); expect(check.out).toContain("SHA256");
  });
});
