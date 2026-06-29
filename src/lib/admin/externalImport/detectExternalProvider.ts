export type ExternalProvider = "hanatour" | "modetour";

const PROVIDER_LABEL: Record<ExternalProvider, string> = {
  hanatour: "하나투어",
  modetour: "모두투어",
};

export function detectExternalProvider(productSourceUrl: string): ExternalProvider | null {
  const url = productSourceUrl.toLowerCase();
  if (url.includes("hanatour.com")) return "hanatour";
  if (url.includes("modetour.com")) return "modetour";
  return null;
}

export function logExternalProvider(productSourceUrl: string): ExternalProvider | null {
  const provider = detectExternalProvider(productSourceUrl);
  if (provider) {
    console.log(`[import-external] provider=${PROVIDER_LABEL[provider]} url=${productSourceUrl}`);
  } else if (productSourceUrl) {
    console.log(`[import-external] provider=unknown url=${productSourceUrl}`);
  }
  return provider;
}

export function getExternalProviderLabel(provider: ExternalProvider | null): string | null {
  return provider ? PROVIDER_LABEL[provider] : null;
}
