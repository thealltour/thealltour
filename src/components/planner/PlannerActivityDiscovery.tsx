"use client";

import { useId, useState } from "react";
import { TpWidgetMount } from "@/components/affiliate/TpWidgetMount";
import {
  buildKlookWidgetSrc,
  buildTiqetsWidgetSrc,
  normalizeTiqetsWidgetProductIds,
} from "@/lib/affiliate/planner/discovery/tpWidgetSrc";
import type { PlannerActivityDiscoveryDto } from "@/lib/affiliate/planner/discovery/types";

const LOADING_TEXT = "상품을 불러오는 중입니다.";

type DiscoveryWidget = { widgetKey: string; src: string };

function tiqetsWidget(discovery: PlannerActivityDiscoveryDto | null | undefined): DiscoveryWidget | null {
  const ids = normalizeTiqetsWidgetProductIds(
    discovery?.tiqets?.products.map((product) => product.productId) ?? [],
  );
  const src = ids ? buildTiqetsWidgetSrc({ productIds: ids }) : null;
  return ids && src ? { widgetKey: `tiqets:${ids.join(",")}`, src } : null;
}

function klookWidget(discovery: PlannerActivityDiscoveryDto | null | undefined): DiscoveryWidget | null {
  const klook = discovery?.klook;
  if (!klook) return null;
  const src = buildKlookWidgetSrc({ cityId: klook.cityId, categoryId: klook.categoryId });
  return src ? { widgetKey: `klook:${klook.cityId}:${klook.categoryId}`, src } : null;
}

function DiscoveryBlock({
  testId,
  title,
  description,
  widget,
}: {
  testId: string;
  title: string;
  description: string;
  widget: DiscoveryWidget;
}) {
  const headingId = useId();
  const [failedKey, setFailedKey] = useState<string | null>(null);
  if (failedKey === widget.widgetKey) return null;

  return (
    <section className="space-y-2.5" aria-labelledby={headingId} data-testid={testId}>
      <div>
        <h2 id={headingId} className="type-body font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        <p className="mt-0.5 type-caption text-[var(--text-muted)]">{description}</p>
      </div>
      <TpWidgetMount
        widgetKey={widget.widgetKey}
        src={widget.src}
        loadingText={LOADING_TEXT}
        onStatusChange={(status) => {
          if (status === "failed") setFailedKey(widget.widgetKey);
        }}
      />
    </section>
  );
}

/**
 * Trip-level activity discovery widgets (Travelpayouts embeds).
 * Tiqets: products matched to the traveler's must-do list. Klook: destination-wide activities.
 * Each provider block hides on its own failure; disclosure is rendered once by the Result view.
 */
export function PlannerActivityDiscovery({
  discovery,
}: {
  discovery: PlannerActivityDiscoveryDto | null | undefined;
}) {
  const tiqets = tiqetsWidget(discovery);
  const klook = klookWidget(discovery);
  if (!tiqets && !klook) return null;

  return (
    <div className="space-y-6" data-testid="planner-activity-discovery">
      {tiqets ? (
        <DiscoveryBlock
          testId="planner-activity-discovery-tiqets"
          title="예약 가능한 명소 · 체험"
          description="일정에 포함된 장소 중 예약 가능한 상품을 모았습니다."
          widget={tiqets}
        />
      ) : null}
      {klook ? (
        <DiscoveryBlock
          testId="planner-activity-discovery-klook"
          title="이런 액티비티도 있어요"
          description="여행지에서 함께 살펴볼 만한 액티비티입니다."
          widget={klook}
        />
      ) : null}
    </div>
  );
}
