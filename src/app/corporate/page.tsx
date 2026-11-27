import type { Metadata } from "next";
import { CorporateHubView } from "@/components/corporate/CorporateHubView";
import { CORPORATE_HUB } from "@/lib/corporate/content";

export const metadata: Metadata = {
  title: CORPORATE_HUB.title,
  description: CORPORATE_HUB.description,
};

export default function CorporateHubPage() {
  return <CorporateHubView />;
}
