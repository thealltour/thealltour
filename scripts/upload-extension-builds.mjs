/**
 * Chrome 익스텐션 ZIP 패키징 후 Supabase Storage(extension-builds) 업로드
 *
 * 사용:
 *   node scripts/upload-extension-builds.mjs
 *   node scripts/upload-extension-builds.mjs --skip-upload
 *   node scripts/upload-extension-builds.mjs --slug=hanatour
 *
 * 필요 env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * CI: main 브랜치 push 시 `.github/workflows/extension-builds.yml`이 자동 업로드합니다.
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
    slug: "hanatour",
    dir: "tools/hanatour-extractor-extension",
  },
  {
    slug: "modetour",
    dir: "tools/modetour-extractor-extension",
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
  const slugArg = argv.find((a) => a.startsWith("--slug="));
  const slugFilter = slugArg ? slugArg.split("=")[1] : null;
  return { skipUpload, skipPackage, slugFilter };
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

async function uploadExtension(supabase, { slug, dir }) {
  const extensionDir = path.join(ROOT, dir);
  const buildDir = path.join(extensionDir, "build");
  const zipName = findZipFile(buildDir);
  if (!zipName) {
    throw new Error(`ZIP not found in ${buildDir}. Run npm run package first.`);
  }

  const zipPath = path.join(buildDir, zipName);
  const zipBuffer = fs.readFileSync(zipPath);
  const version = readPackageVersion(extensionDir);
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
  const { skipUpload, skipPackage, slugFilter } = parseArgs(process.argv.slice(2));
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

  if (skipUpload) {
    console.log("\n[done] --skip-upload: local package only.");
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
