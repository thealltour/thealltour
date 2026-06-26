import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  EXTENSION_BUILDS_BUCKET,
  EXTENSION_DISPLAY,
  extensionManifestStoragePath,
  extensionZipStoragePath,
  isExtensionSlug,
  type ExtensionBuildManifest,
} from "@/lib/extensionBuilds";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("tools.view");
  if (!auth.ok) return auth.res;

  const { slug } = await context.params;
  if (!isExtensionSlug(slug)) {
    return NextResponse.json({ message: "지원하지 않는 익스텐션입니다." }, { status: 404 });
  }

  const zipPath = extensionZipStoragePath(slug);
  const { data: zipBlob, error: zipError } = await supabaseAdmin.storage
    .from(EXTENSION_BUILDS_BUCKET)
    .download(zipPath);

  if (zipError || !zipBlob) {
    return NextResponse.json(
      { message: "업로드된 익스텐션 파일이 없습니다. 빌드 후 업로드 스크립트를 실행해 주세요." },
      { status: 404 },
    );
  }

  let fileName = EXTENSION_DISPLAY[slug].downloadFileName;
  const { data: manifestBlob } = await supabaseAdmin.storage
    .from(EXTENSION_BUILDS_BUCKET)
    .download(extensionManifestStoragePath(slug));

  if (manifestBlob) {
    try {
      const manifest = JSON.parse(await manifestBlob.text()) as ExtensionBuildManifest;
      if (manifest.fileName) fileName = manifest.fileName;
    } catch {
      // fallback fileName
    }
  }

  const buffer = await zipBlob.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
