import { redirect } from "next/navigation";
import { buildLegacySearchRedirectHref } from "@/lib/search/legacySearchRedirect";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    destination?: string;
    theme?: string;
    product_line?: string;
    sort?: string;
    page?: string;
  }>;
};

/**
 * Legacy `/search` entry.
 * Canonical Search Journey는 `/products?q=` (PR-UI-02).
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  redirect(
    buildLegacySearchRedirectHref(params as Record<string, string | string[] | undefined>),
  );
}
