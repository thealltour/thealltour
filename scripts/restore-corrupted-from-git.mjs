import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const files = [
  { head: "src/components/ProductDetailHero.tsx", dest: "src/components/product-detail/ProductDetailHero.tsx" },
  { head: "src/components/ProductDetailSticky.tsx", dest: "src/components/product-detail/ProductDetailSticky.tsx" },
  { head: "src/components/MobileFloatingMenu.tsx", dest: "src/components/site-chrome/MobileFloatingMenu.tsx" },
];

for (const { head, dest } of files) {
  let c = execSync(`git show HEAD:${head}`, { encoding: "utf8", cwd: root, maxBuffer: 10 * 1024 * 1024 });
  c = c.split("@/components/ConsultModal").join("@/components/inquiry/ConsultModal");
  const out = path.join(root, dest);
  fs.writeFileSync(out, c, "utf8");
  console.log("restored", dest);
}
