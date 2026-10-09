import { spawn } from "node:child_process";
import { NarrationError } from "../narration/persistence";
/** Remote command contains only server-configured restricted path tokens; payload uses stdin. */
export function executeMiniMotion(payload: string): Promise<string> {
  const host = process.env.NARRATION_MOTION_SSH_HOST || "thealltour-ai";
  const python = process.env.NARRATION_MOTION_PYTHON || "/home/ysh/experiments/thealltour-narration-motion/venv/bin/python";
  const runner = process.env.NARRATION_MOTION_RUNNER || "/home/ysh/experiments/thealltour-narration-motion/runner.py";
  if (!/^[a-zA-Z0-9_.@-]+$/.test(host) || ![python, runner].every(p => /^\/[a-zA-Z0-9_/.-]+$/.test(p) && !p.includes(".."))) throw new NarrationError("미니 PC 실행 설정을 확인해주세요.", 503);
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3", host, python, runner], { shell: false, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = []; let size = 0; let finished = false; let errorTail = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); done(new Error("remote_timeout")); }, 10 * 60_000);
    function done(error?: Error) { if (finished) return; finished = true; clearTimeout(timer); if (error) reject(error); else resolve(Buffer.concat(chunks).toString("utf8")); }
    child.stdout.on("data", (b: Buffer) => { size += b.length; if (size > 36 * 1024 * 1024) { child.kill(); done(new Error("remote_output_too_large")); } else chunks.push(b); });
    // Do not return remote logs, paths or payloads to the browser.
    child.stderr.on("data", (b: Buffer) => { errorTail = (errorTail + b.toString("utf8")).slice(-8192); });
    child.on("error", error => done(error)); child.stdin.on("error", error => done(error));
    child.on("close", code => done(code === 0 ? undefined : new Error(errorTail.includes("motion_bounds_exceeded") ? "motion_bounds_exceeded" : "remote_runner_failed")));
    child.stdin.end(payload);
  });
}
