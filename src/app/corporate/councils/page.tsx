import type { Metadata } from "next";
import { CorporateSegmentLayout } from "@/components/corporate/CorporateSegmentLayout";
import { getCorporateSegment } from "@/lib/corporate/content";

const segment = getCorporateSegment("councils");

export const metadata: Metadata = {
  title: segment.title,
  description: segment.description,
};

export default function CorporateCouncilsPage() {
  return <CorporateSegmentLayout segment={segment} />;
}
