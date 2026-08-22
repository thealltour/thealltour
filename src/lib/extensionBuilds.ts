export const EXTENSION_BUILDS_BUCKET = "extension-builds";

export const EXTENSION_SLUGS = ["modetour", "thealltour-extension"] as const;

export type ExtensionSlug = (typeof EXTENSION_SLUGS)[number];

export type ExtensionBuildManifest = {
  version: string;
  uploadedAt: string;
  fileName: string;
};

export const EXTENSION_DISPLAY: Record<
  ExtensionSlug,
  { title: string; description: string; downloadFileName: string; downloadButtonLabel: string }
> = {
  modetour: {
    title: "모두투어 상품 추출기",
    description: "모두투어 상품 상세 페이지에서 상품 JSON을 추출합니다.",
    downloadFileName: "modetour-extractor.zip",
    downloadButtonLabel: "모두투어 익스텐션.zip 다운로드",
  },
  "thealltour-extension": {
    title: "thealltour_hanatour_collector",
    description:
      "하나투어 상품 상세에서 본문·일정·출발일·이미지를 수집해 Markdown/JSON으로 검증하거나 더올투어 관리자에 AI 임포트합니다.",
    downloadFileName: "thealltour_hanatour_collector.zip",
    downloadButtonLabel: "thealltour_hanatour_collector.zip 다운로드",
  },
};

/** 관리자 다운로드 slug → 소스 폴더 (tools/ 하위) */
export const EXTENSION_SOURCE_DIR: Record<ExtensionSlug, string> = {
  modetour: "tools/modetour-extractor-extension",
  "thealltour-extension": "tools/thealltour_hanatour_collector",
};

export function isExtensionSlug(value: string): value is ExtensionSlug {
  return (EXTENSION_SLUGS as readonly string[]).includes(value);
}

export function extensionZipStoragePath(slug: ExtensionSlug): string {
  return `${slug}/latest.zip`;
}

export function extensionManifestStoragePath(slug: ExtensionSlug): string {
  return `${slug}/manifest.json`;
}

/** Vercel 배포에 포함되는 다운로드 아티팩트 (git에 커밋). */
export const COMMITTED_EXTENSION_BUILDS_DIR = "public/extension-builds";

export function committedExtensionDirRel(slug: ExtensionSlug): string {
  return `${COMMITTED_EXTENSION_BUILDS_DIR}/${slug}`;
}

export function committedExtensionZipRelPath(slug: ExtensionSlug): string {
  return `${committedExtensionDirRel(slug)}/latest.zip`;
}

export function committedExtensionManifestRelPath(slug: ExtensionSlug): string {
  return `${committedExtensionDirRel(slug)}/manifest.json`;
}
