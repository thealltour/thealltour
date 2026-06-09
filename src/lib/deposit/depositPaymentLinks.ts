export type DepositPaymentLink = {
  id: string;
  label: string;
  url: string;
};

function newLinkId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** site_settings JSON + 구 단일 URL(legacy) → 정규화된 결제링크 목록 */
export function parseDepositPaymentLinks(
  linksJson?: string | null,
  legacySingleUrl?: string | null,
): DepositPaymentLink[] {
  const parsed: DepositPaymentLink[] = [];

  if (typeof linksJson === "string" && linksJson.trim()) {
    try {
      const raw = JSON.parse(linksJson) as unknown;
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (!item || typeof item !== "object") continue;
          const label = String((item as { label?: unknown }).label ?? "").trim();
          const url = String((item as { url?: unknown }).url ?? "").trim();
          if (!label || !url.startsWith("http")) continue;
          const id = String((item as { id?: unknown }).id ?? "").trim() || newLinkId();
          parsed.push({ id, label, url });
        }
      }
    } catch {
      // fall through to legacy
    }
  }

  if (parsed.length > 0) return parsed;

  const legacy = legacySingleUrl?.trim();
  if (legacy && legacy.startsWith("http")) {
    return [{ id: newLinkId(), label: "결제링크로 이동", url: legacy }];
  }

  return [];
}

export function serializeDepositPaymentLinks(links: DepositPaymentLink[]): string {
  const normalized = links
    .map((link) => ({
      id: link.id.trim() || newLinkId(),
      label: link.label.trim(),
      url: link.url.trim(),
    }))
    .filter((link) => link.label && link.url.startsWith("http"));
  return JSON.stringify(normalized);
}

export function createEmptyDepositPaymentLink(): DepositPaymentLink {
  return { id: newLinkId(), label: "", url: "" };
}
