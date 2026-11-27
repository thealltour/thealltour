import type { Metadata } from "next";
import { CorporateSegmentLayout } from "@/components/corporate/CorporateSegmentLayout";
import { getCorporateSegment } from "@/lib/corporate/content";

const segment = getCorporateSegment("public-enterprises");

export const metadata: Metadata = {
  title: segment.title,
  description: segment.description,
};

export default function CorporatePublicEnterprisesPage() {
  return <CorporateSegmentLayout segment={segment} />;
}
