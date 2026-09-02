import { notFound } from "next/navigation";

/**
 * Development-only App Router pages (`/dev/*`) must call this at the top of the page.
 * Production requests receive a server 404 — no client-only hide.
 */
export function assertDevRoutesEnabled(): void {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
}
