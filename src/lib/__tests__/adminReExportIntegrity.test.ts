import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const adminRoot = path.join(process.cwd(), "src/app/admin");
const managerRoot = path.join(process.cwd(), "src/app/theall_manager_only");

function listPageFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listPageFiles(full, acc);
    else if (entry.name === "page.tsx") acc.push(full);
  }
  return acc;
}

describe("admin re-export integrity", () => {
  it("maps each theall_manager_only page to admin implementation", () => {
    const managerPages = listPageFiles(managerRoot);
    const missing: string[] = [];

    for (const managerPage of managerPages) {
      const rel = path.relative(managerRoot, managerPage).replace(/\\/g, "/");
      const adminPage = path.join(adminRoot, rel);
      const content = fs.readFileSync(managerPage, "utf8").trim();

      if (content.startsWith('export { default } from "@/app/admin/')) {
        const adminTarget = content.match(/from "@\/app\/admin\/([^"]+)"/)?.[1];
        const adminPageFromExport = adminTarget
          ? path.join(adminRoot, adminTarget.replace(/\//g, path.sep))
          : adminPage;
        if (!fs.existsSync(adminPageFromExport.endsWith(".tsx") ? adminPageFromExport : `${adminPageFromExport}.tsx`) && !fs.existsSync(adminPage)) {
          missing.push(rel);
        }
        continue;
      }

      if (rel.startsWith("review-summaries/")) {
        if (!fs.existsSync(path.join(adminRoot, "reviews/summaries/page.tsx"))) {
          missing.push(rel);
        }
        continue;
      }

      if (rel.startsWith("review-reminders/")) {
        continue;
      }

      if (!fs.existsSync(adminPage)) missing.push(rel);
    }

    expect(missing).toEqual([]);
  });
});
