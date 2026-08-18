/**
 * Chrome 익스텐션 ZIP 패키징 → public/extension-builds 복사(git 커밋용) → Supabase 업로드
 *
 * 사용:
 *   node scripts/upload-extension-builds.mjs
 *   node scripts/upload-extension-builds.mjs --skip-upload
 *   node scripts/upload-extension-builds.mjs --slug=thealltour-extension
 *
 * 도구 페이지 다운로드의 1차 소스는 git에 커밋된
 * `public/extension-builds/<slug>/latest.zip` 입니다. 패키징 후 이 파일을
 * 커밋·push 해야 운영 배포에서 새 버전이 내려받힙니다.
 *
 * 필요 env (.env.local, 업로드 시): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * CI: main 브랜치 push 시 `.github/workflows/extension-builds.yml`이 Supabase에도 올립니다.
 * GitHub Secrets: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BUCKET = "extension-builds";

const EXTENSIONS = [
  {
    slug: "modetour",
    dir: "tools/modetour-extractor-extension",
  },
  {
    slug: "thealltour-extension",
    dir: "tools/thealltour_extension",
  },
];

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const skipUpload = argv.includes("--skip-upload");
  const skipPackage = argv.includes("--skip-package");
  const skipPublic = argv.includes("--skip-public");
  const slugArg = argv.find((a) => a.startsWith("--slug="));
  const slugFilter = slugArg ? slugArg.split("=")[1] : null;
  return { skipUpload, skipPackage, skipPublic, slugFilter };
}

function findZipFile(buildDir) {
  if (!fs.existsSync(buildDir)) return null;
  const zips = fs
    .readdirSync(buildDir)
    .filter((name) => name.toLowerCase().endsWith(".zip"))
    .map((name) => ({
      name,
      mtime: fs.statSync(path.join(buildDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return zips[0]?.name ?? null;
}

function readPackageVersion(extensionDir) {
  const pkgPath = path.join(extensionDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return String(pkg.version ?? "0.0.0");
}

function runPackage(extensionDir) {
  console.log(`\n[package] ${extensionDir}`);
  execSync("npm run package", {
    cwd: extensionDir,
    stdio: "inherit",
    shell: true,
  });
}

function copyToPublic(slug, zipPath, zipName, version) {
  const destDir = path.join(ROOT, "public", "extension-builds", slug);
  fs.mkdirSync(destDir, { recursive: true });

  const latestPath = path.join(destDir, "latest.zip");
  fs.copyFileSync(zipPath, latestPath);
  const versionedPath = path.join(destDir, zipName);
  if (path.resolve(versionedPath) !== path.resolve(latestPath)) {
    fs.copyFileSync(zipPath, versionedPath);
  }

  for (const name of fs.readdirSync(destDir)) {
    if (!name.toLowerCase().endsWith(".zip")) continue;
    if (name === "latest.zip" || name === zipName) continue;
    fs.unlinkSync(path.join(destDir, name));
  }

  const manifest = {
    version,
    uploadedAt: new Date().toISOString(),
    fileName: zipName,
  };
  fs.writeFileSync(path.join(destDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const bytes = fs.statSync(latestPath).size;
  console.log(`[ok] public copy ${slug} v${version} → public/extension-builds/${slug}/ (${zipName}, ${bytes} bytes)`);
}

async function ensureBucket(supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }
  if (buckets?.some((b) => b.id === BUCKET || b.name === BUCKET)) {
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "application/json",
    ],
  });
  if (createError) {
    throw new Error(`Failed to create bucket "${BUCKET}": ${createError.message}`);
  }
  console.log(`[ok] Created storage bucket: ${BUCKET}`);
}

function resolveBuiltZip(dir) {
  const extensionDir = path.join(ROOT, dir);
  const buildDir = path.join(extensionDir, "build");
  const zipName = findZipFile(buildDir);
  if (!zipName) {
    throw new Error(`ZIP not found in ${buildDir}. Run npm run package first.`);
  }
  return {
    extensionDir,
    zipName,
    zipPath: path.join(buildDir, zipName),
    version: readPackageVersion(extensionDir),
  };
}

async function uploadExtension(supabase, { slug, dir }) {
  const { zipName, zipPath, version } = resolveBuiltZip(dir);
  const zipBuffer = fs.readFileSync(zipPath);
  const uploadedAt = new Date().toISOString();
  const storageZipPath = `${slug}/latest.zip`;
  const storageManifestPath = `${slug}/manifest.json`;
  const manifest = {
    version,
    uploadedAt,
    fileName: zipName,
  };

  const removeRes = await supabase.storage.from(BUCKET).remove([storageZipPath, storageManifestPath]);
  if (removeRes.error) {
    console.warn(`[warn] remove old files (${slug}):`, removeRes.error.message);
  }

  const uploadZipRes = await supabase.storage.from(BUCKET).upload(storageZipPath, zipBuffer, {
    contentType: "application/zip",
    upsert: true,
  });
  if (uploadZipRes.error) {
    throw new Error(`ZIP upload failed (${slug}): ${uploadZipRes.error.message}`);
  }

  const uploadManifestRes = await supabase.storage
    .from(BUCKET)
    .upload(storageManifestPath, JSON.stringify(manifest, null, 2), {
      contentType: "application/json",
      upsert: true,
    });
  if (uploadManifestRes.error) {
    throw new Error(`manifest upload failed (${slug}): ${uploadManifestRes.error.message}`);
  }

  console.log(`[ok] ${slug} v${version} → ${storageZipPath} (${zipName}, ${zipBuffer.length} bytes)`);
}

async function main() {
  const { skipUpload, skipPackage, skipPublic, slugFilter } = parseArgs(process.argv.slice(2));
  const targets = EXTENSIONS.filter((ext) => !slugFilter || ext.slug === slugFilter);
  if (targets.length === 0) {
    console.error("No matching extension slug.");
    process.exit(1);
  }

  if (!skipPackage) {
    for (const ext of targets) {
      runPackage(path.join(ROOT, ext.dir));
    }
  }

  if (!skipPublic) {
    for (const ext of targets) {
      const built = resolveBuiltZip(ext.dir);
      copyToPublic(ext.slug, built.zipPath, built.zipName, built.version);
    }
  }

  if (skipUpload) {
    console.log("\n[done] --skip-upload: packaged and copied to public/extension-builds. Commit that folder to ship downloads.");
    return;
  }

  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureBucket(supabase);

  for (const ext of targets) {
    await uploadExtension(supabase, ext);
  }

  console.log("\n[done] Extension builds uploaded to Supabase Storage.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
