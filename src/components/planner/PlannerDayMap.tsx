"use client";

import { useEffect, useRef, useState } from "react";
import {
  getGoogleMapsBrowserKey,
  loadGoogleMapsBrowserApi,
} from "@/lib/planner/loadGoogleMapsBrowserApi";
import { trackPlannerMapLoaded } from "@/lib/analytics/trackPlannerEvents";

export type PlannerMapMarker = {
  order: number;
  title: string;
  address: string | null;
  lat: number;
  lng: number;
};

type PlannerDayMapProps = {
  sessionId: string;
  dayNumber: number;
  markers: PlannerMapMarker[];
};

export function PlannerDayMap({ sessionId, dayNumber, markers }: PlannerDayMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const tracked = useRef(false);
  const browserKeyMissing = !getGoogleMapsBrowserKey();

  useEffect(() => {
    if (markers.length === 0 || browserKeyMissing) return;

    let cancelled = false;
    let mapInstance: google.maps.Map | null = null;

    void (async () => {
      try {
        const maps = await loadGoogleMapsBrowserApi();
        if (cancelled || !containerRef.current) return;

        const center = { lat: markers[0]!.lat, lng: markers[0]!.lng };
        mapInstance = new maps.Map(containerRef.current, {
          center,
          zoom: markers.length === 1 ? 15 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        const bounds = new maps.LatLngBounds();
        for (const marker of markers) {
          const position = { lat: marker.lat, lng: marker.lng };
          bounds.extend(position);
          const m = new maps.Marker({
            map: mapInstance,
            position,
            label: {
              text: String(marker.order),
              color: "#ffffff",
              fontWeight: "700",
            },
            title: marker.title,
          });
          if (marker.address) {
            const info = new maps.InfoWindow({
              content: `<div style="font-size:12px;padding:2px 4px;"><strong>${escapeHtml(marker.title)}</strong><br/>${escapeHtml(marker.address)}</div>`,
            });
            m.addListener("click", () => info.open({ map: mapInstance!, anchor: m }));
          }
        }

        if (markers.length > 1) {
          mapInstance.fitBounds(bounds, 48);
        }

        if (!tracked.current) {
          tracked.current = true;
          trackPlannerMapLoaded({
            sessionId,
            dayNumber,
            mappedPlaceCount: markers.length,
          });
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      mapInstance = null;
    };
  }, [browserKeyMissing, dayNumber, markers, sessionId]);

  if (markers.length === 0) return null;

  if (browserKeyMissing || loadError) {
    return (
      <p className="type-caption text-[var(--text-muted)]" role="status">
        지도를 불러올 수 없습니다.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[280px] w-full overflow-hidden rounded-xl border border-[var(--border)] sm:h-[320px]"
      role="img"
      aria-label={`DAY ${dayNumber} 장소 지도`}
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
