import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./stub-server-only-register.mjs", pathToFileURL("./"));

const { spawnSync } = await import("node:child_process");
const r = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--import",
    new URL("./stub-server-only-register.mjs", import.meta.url).href,
    new URL("./smoke-aviasales-live.ts", import.meta.url).pathname.replace(/^\//, ""),
  ],
  { stdio: "inherit", cwd: process.cwd(), env: process.env, shell: false },
);
process.exit(r.status ?? 1);
