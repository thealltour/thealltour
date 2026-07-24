export type MemberAcquisition = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  landing_path: string | null;
  landing_slug: string | null;
};

export function parseMemberAcquisitionFromSearchParams(
  params: URLSearchParams,
): MemberAcquisition | null {
  const utm_source = params.get("utm_source")?.trim() || null;
  const utm_medium = params.get("utm_medium")?.trim() || null;
  const utm_campaign = params.get("utm_campaign")?.trim() || null;
  const utm_term = params.get("utm_term")?.trim() || null;
  const utm_content = params.get("utm_content")?.trim() || null;
  const landing_path = params.get("landing_path")?.trim() || null;
  const landing_slug = params.get("landing_slug")?.trim() || null;

  const hasAny =
    utm_source ||
    utm_medium ||
    utm_campaign ||
    utm_term ||
    utm_content ||
    landing_path ||
    landing_slug;
  if (!hasAny) return null;

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    landing_path,
    landing_slug,
  };
}
