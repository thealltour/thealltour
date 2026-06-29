export const EXTENSION_BUILDS_BUCKET = "extension-builds";

export const EXTENSION_SLUGS = ["hanatour", "modetour", "thealltour-extension"] as const;

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
  hanatour: {
    title: "하나투어 상품 추출기",
    description: "하나투어 패키지 상세 페이지에서 상품 JSON을 추출합니다.",
    downloadFileName: "hanatour-extractor.zip",
    downloadButtonLabel: "하나투어 익스텐션.zip 다운로드",
  },
  modetour: {
    title: "모두투어 상품 추출기",
    description: "모두투어 상품 상세 페이지에서 상품 JSON을 추출합니다.",
    downloadFileName: "modetour-extractor.zip",
    downloadButtonLabel: "모두투어 익스텐션.zip 다운로드",
  },
  "thealltour-extension": {
    title: "thealltour_extension",
    description: "하나투어·모두투어 상세 페이지를 수집해 더올투어 관리자에 AI 임포트합니다.",
    downloadFileName: "thealltour-extension.zip",
    downloadButtonLabel: "thealltour_extension.zip 다운로드",
  },
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
