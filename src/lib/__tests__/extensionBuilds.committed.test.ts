import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  committedExtensionManifestRelPath,
  committedExtensionZipRelPath,
  EXTENSION_SOURCE_DIR,
} from "@/lib/extensionBuilds";

const SLUG = "thealltour-extension" as const;
const ROOT = process.cwd();

describe("committed thealltour-extension download artifact", () => {
  const pkgPath = path.join(ROOT, EXTENSION_SOURCE_DIR[SLUG], "package.json");
  const manifestPath = path.join(ROOT, committedExtensionManifestRelPath(SLUG));
  const zipPath = path.join(ROOT, committedExtensionZipRelPath(SLUG));

  it("keeps public zip version in sync with thealltour_hanatour_collector package", async () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string };
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(zipPath)).toBe(true);

    const committed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      version: string;
      fileName: string;
    };
    expect(committed.version).toBe(pkg.version);
    expect(committed.fileName).toContain("thealltour_hanatour_collector");
    expect(fs.statSync(zipPath).size).toBeGreaterThan(1000);

    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const inner = zip.file("manifest.json");
    expect(inner).toBeTruthy();
    const innerManifest = JSON.parse(await inner!.async("string")) as { version: string; name?: string };
    expect(innerManifest.version).toBe(pkg.version);
    expect(innerManifest.name).toBe("thealltour_hanatour_collector");
  });
});
