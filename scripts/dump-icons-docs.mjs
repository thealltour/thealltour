import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function walkTs(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) {
      if (n.name === ".next" || n.name === "node_modules") continue;
      walkTs(p, acc);
    } else if (/\.tsx?$/.test(n.name)) acc.push(p);
  }
}

function rel(p) {
  return path.relative(root, p).replace(/\\/g, "/");
}

function writeBundle(outName, files, title) {
  let body = `# ${title}\n\n> 자동 생성 (${new Date().toISOString().slice(0, 10)}). 파일 수: ${files.length}\n\n`;
  for (const f of files) {
    const c = fs.readFileSync(f, "utf8");
    body += `\n---\n\n## \`${rel(f)}\`\n\n\`\`\`tsx\n${c}\n\`\`\`\n`;
  }
  fs.writeFileSync(path.join(root, "docs", outName), body, "utf8");
}

const allSrc = [];
walkTs(path.join(root, "src"), allSrc);

const lucide = allSrc.filter((f) => fs.readFileSync(f, "utf8").includes("lucide-react")).sort();
writeBundle("project-icons-lucide-sources.md", lucide, "부록 A: lucide-react 사용 소스 전체");

const svg = allSrc.filter((f) => /\.tsx$/.test(f) && /<svg[\s>]/.test(fs.readFileSync(f, "utf8"))).sort();
writeBundle("project-icons-inline-svg-sources.md", svg, "부록 B: 인라인 `<svg>` 사용 TSX 전체");

const logo = allSrc.filter((f) => fs.readFileSync(f, "utf8").includes("thealltour-logo")).sort();
writeBundle("project-brand-logo-sources.md", logo, "부록 C: `thealltour-logo.png` 참조 소스 전체");

console.log("lucide:", lucide.length, "svg:", svg.length, "logo:", logo.length);
