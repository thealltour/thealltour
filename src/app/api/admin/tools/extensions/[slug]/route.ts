import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readCommittedExtensionManifest } from "@/lib/extensionBuildFiles";
import {
  EXTENSION_BUILDS_BUCKET,
  extensionManifestStoragePath,
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

  const committed = readCommittedExtensionManifest(slug);
  if (committed) {
    return NextResponse.json({
      slug,
      available: true,
      manifest: committed,
    });
  }

  const manifestPath = extensionManifestStoragePath(slug);
  const { data, error } = await supabaseAdmin.storage.from(EXTENSION_BUILDS_BUCKET).download(manifestPath);

  if (error || !data) {
    return NextResponse.json({
      slug,
      available: false,
      manifest: null,
    });
  }

  try {
    const text = await data.text();
    const manifest = JSON.parse(text) as ExtensionBuildManifest;
    return NextResponse.json({
      slug,
      available: true,
      manifest,
    });
  } catch {
    return NextResponse.json({
      slug,
      available: false,
      manifest: null,
    });
  }
}
