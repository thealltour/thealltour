"use client";

import { useId, useState } from "react";
import { ChevronRight, Ticket } from "lucide-react";
import { TpWidgetMount } from "@/components/affiliate/TpWidgetMount";
import {
  preparationHubActivityBlurb,
  preparationHubActivityCardHint,
  preparationHubCardShellClassName,
  preparationHubCtaClassName,
  preparationHubCtaLabel,
  preparationHubIconClassName,
  preparationHubProviderLabel,
} from "@/components/planner/preparationHubPresentation";
import {
  buildKlookWidgetSrc,
  buildTiqetsWidgetSrc,
  normalizeTiqetsWidgetProductIds,
} from "@/lib/affiliate/planner/discovery/tpWidgetSrc";
import type { PlannerActivityDiscoveryDto } from "@/lib/affiliate/planner/discovery/types";
import { cn } from "@/lib/cn";

const LOADING_TEXT = "상품을 불러오는 중입니다.";

type DiscoveryWidget = { widgetKey: string; src: string; providerId: "klook" | "tiqets" };

/** Browser localhost Hub QA — skipped under Vitest (jsdom host is also localhost). */
function preferLocalWidgetFallback(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function tiqetsWidget(discovery: PlannerActivityDiscoveryDto | null | undefined): DiscoveryWidget | null {
  const ids = normalizeTiqetsWidgetProductIds(
    discovery?.tiqets?.products.map((product) => product.productId) ?? [],
  );
  const src = ids ? buildTiqetsWidgetSrc({ productIds: ids }) : null;
  return ids && src ? { widgetKey: `tiqets:${ids.join(",")}`, src, providerId: "tiqets" } : null;
}

function klookWidget(discovery: PlannerActivityDiscoveryDto | null | undefined): DiscoveryWidget | null {
  const klook = discovery?.klook;
  if (!klook) return null;
  const src = buildKlookWidgetSrc({ cityId: klook.cityId, categoryId: klook.categoryId });
  return src ? { widgetKey: `klook:${klook.cityId}:${klook.categoryId}`, src, providerId: "klook" } : null;
}

function klookFallbackHref(discovery: PlannerActivityDiscoveryDto): string | null {
  const cityId = discovery.klook?.cityId?.trim();
  if (!cityId) return null;
  const label = (discovery.klook?.cityLabel || "").trim().toLowerCase().replace(/\s+/g, "-");
  const slug = label || "city";
  return `https://www.klook.com/ko/city/${cityId}-${slug}/`;
}

function tiqetsFallbackHref(discovery: PlannerActivityDiscoveryDto): string | null {
  const first = discovery.tiqets?.products?.[0]?.productId?.trim();
  if (!first) return null;
  return `https://www.tiqets.com/ko/search/?q=${encodeURIComponent(first)}`;
}

function DiscoveryFallbackLinks({
  discovery,
  destinationName,
  embedded,
}: {
  discovery: PlannerActivityDiscoveryDto;
  destinationName: string;
  embedded: boolean;
}) {
  const items: Array<{
    testId: string;
    href: string;
    providerId: "klook" | "tiqets";
  }> = [];
  const klookHref = klookFallbackHref(discovery);
  const tiqetsHref = tiqetsFallbackHref(discovery);
  if (klookHref) {
    items.push({
      testId: "planner-activity-discovery-fallback-klook",
      href: klookHref,
      providerId: "klook",
    });
  }
  if (tiqetsHref) {
    items.push({
      testId: "planner-activity-discovery-fallback-tiqets",
      href: tiqetsHref,
      providerId: "tiqets",
    });
  }
  if (items.length === 0) return null;

  const cta = preparationHubCtaLabel("activity");
  const sectionBlurb = preparationHubActivityBlurb(destinationName);
  const cardHint = preparationHubActivityCardHint(destinationName);

  return (
    <div
      className={cn(embedded ? "space-y-2.5" : "space-y-3")}
      data-testid="planner-activity-discovery-fallback"
    >
      {embedded ? null : (
        <div>
          <h2 className="type-body font-semibold text-[var(--foreground)]">티켓 · 액티비티</h2>
          <p className="mt-0.5 type-caption text-[var(--text-muted)]">{sectionBlurb}</p>
        </div>
      )}
      <ul
        className={cn(
          embedded
            ? "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            : "space-y-2",
        )}
      >
        {items.map((item) => {
          const provider = preparationHubProviderLabel(item.providerId);
          return (
            <li key={item.testId} className={embedded ? "px-3.5 py-3.5" : undefined}>
              {embedded ? (
                <div className="flex gap-3 motion-safe:transition-colors motion-safe:duration-150">
                  <div className={preparationHubIconClassName} aria-hidden={true}>
                    <Ticket />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="type-small font-semibold text-[var(--foreground)]">티켓 · 액티비티</p>
                    <p className="mt-0.5 type-caption text-[var(--text-muted)]">{cardHint}</p>
                    {provider ? (
                      <p className="mt-1 type-caption text-slate-500">{provider}</p>
                    ) : null}
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(preparationHubCtaClassName, "mt-2.5 w-full min-w-[9.5rem] sm:w-auto")}
                      data-testid={item.testId}
                    >
                      <span className="truncate">{cta}</span>
                      <ChevronRight aria-hidden={true} />
                    </a>
                  </div>
                </div>
              ) : (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    preparationHubCardShellClassName,
                    "inline-flex min-h-11 w-full items-center justify-between gap-3 border-l-[3px] border-l-[#087EA4] px-3 type-body text-[var(--foreground)]",
                  )}
                  data-testid={item.testId}
                >
                  <span className="min-w-0 font-semibold">{cta}</span>
                  {provider ? (
                    <span className="shrink-0 type-caption text-slate-500">{provider}</span>
                  ) : null}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DiscoveryBlock({
  testId,
  title,
  description,
  widget,
  embedded,
}: {
  testId: string;
  title: string;
  description: string;
  widget: DiscoveryWidget;
  embedded: boolean;
}) {
  const headingId = useId();
  const [status, setStatus] = useState<"idle" | "loading" | "rendered" | "failed">("idle");
  const provider = preparationHubProviderLabel(widget.providerId);
  if (status === "failed") return null;

  return (
    <section
      className={cn(embedded ? "space-y-2" : "space-y-2.5")}
      aria-labelledby={headingId}
      data-testid={testId}
    >
      {embedded ? (
        status === "rendered" ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn(preparationHubIconClassName, "h-8 w-8")} aria-hidden={true}>
              <Ticket className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p id={headingId} className="type-caption font-semibold text-[var(--foreground)]">
                {title}
              </p>
              {provider ? (
                <p className="type-caption text-slate-500">{provider}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <span id={headingId} className="sr-only">
            {title}
          </span>
        )
      ) : status === "rendered" ? (
        <div>
          <h2 id={headingId} className="type-body font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <p className="mt-0.5 type-caption text-[var(--text-muted)]">{description}</p>
          {provider ? (
            <p className="mt-1 type-caption text-slate-500">{provider}</p>
          ) : null}
        </div>
      ) : (
        <span id={headingId} className="sr-only">
          {title}
        </span>
      )}
      <TpWidgetMount
        widgetKey={widget.widgetKey}
        src={widget.src}
        loadingText={LOADING_TEXT}
        onStatusChange={(next) => {
          setStatus(next);
        }}
      />
    </section>
  );
}

/**
 * Trip-level activity discovery widgets (Travelpayouts embeds).
 * Tiqets: products matched to the traveler's must-do list. Klook: destination-wide activities.
 * Each provider block hides on its own failure; disclosure is rendered once by the Hub.
 * On localhost the TP widget often renders an empty iframe (publisher_host), so deep-link CTAs
 * are shown instead — with user-facing copy only.
 */
export function PlannerActivityDiscovery({
  discovery,
  variant = "standalone",
  destinationName = "",
}: {
  discovery: PlannerActivityDiscoveryDto | null | undefined;
  /** Hub already owns the section title — keep nested chrome quiet. */
  variant?: "standalone" | "hub";
  destinationName?: string;
}) {
  if (!discovery) return null;
  const embedded = variant === "hub";

  if (preferLocalWidgetFallback()) {
    const fallback = (
      <DiscoveryFallbackLinks
        discovery={discovery}
        destinationName={destinationName}
        embedded={embedded}
      />
    );
    return fallback ? (
      <div
        className={cn(embedded ? "space-y-2.5" : "space-y-6")}
        data-testid="planner-activity-discovery"
      >
        {fallback}
      </div>
    ) : null;
  }

  const tiqets = tiqetsWidget(discovery);
  const klook = klookWidget(discovery);
  if (!tiqets && !klook) return null;

  return (
    <div
      className={cn(embedded ? "space-y-4" : "space-y-6")}
      data-testid="planner-activity-discovery"
    >
      {tiqets ? (
        <DiscoveryBlock
          testId="planner-activity-discovery-tiqets"
          title={embedded ? "일정에 맞는 티켓" : "예약 가능한 명소 · 체험"}
          description={
            embedded
              ? preparationHubActivityCardHint(destinationName)
              : "일정에 포함된 장소 중 예약 가능한 상품을 모았습니다."
          }
          widget={tiqets}
          embedded={embedded}
        />
      ) : null}
      {klook ? (
        <DiscoveryBlock
          testId="planner-activity-discovery-klook"
          title={embedded ? "더 살펴볼 체험" : "이런 액티비티도 있어요"}
          description={
            embedded
              ? preparationHubActivityCardHint(destinationName)
              : "여행지에서 함께 살펴볼 만한 액티비티입니다."
          }
          widget={klook}
          embedded={embedded}
        />
      ) : null}
    </div>
  );
}
