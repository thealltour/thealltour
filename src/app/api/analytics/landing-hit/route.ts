/**
 * Middleware → 서버 landing_view 적재.
 * JS 하이드레이션 전에 이탈해도 조회가 남도록 S2S로 기록한다.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import {
  resolveKakaoSyncLandingHitTarget,
  type KakaoSyncLandingHitTarget,
} from "@/lib/analytics/kakaoSyncLandingHit";

type Body = {
  pathname?: unknown;
  sourcePath?: unknown;
  landingSlug?: unknown;
  templateType?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_term?: unknown;
  utm_content?: unknown;
  userAgent?: unknown;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function resolveTarget(body: Body): KakaoSyncLandingHitTarget | null {
  const pathname = str(body.pathname) ?? str(body.sourcePath);
  if (pathname) {
    const fromPath = resolveKakaoSyncLandingHitTarget(pathname);
    if (fromPath) return fromPath;
  }
  const sourcePath = str(body.sourcePath);
  const landingSlug = str(body.landingSlug);
  const templateType = str(body.templateType);
  if (sourcePath && landingSlug && templateType) {
    const allowed = resolveKakaoSyncLandingHitTarget(sourcePath);
    if (!allowed) return null;
    return allowed;
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const target = resolveTarget(body);
  if (!target) {
    return NextResponse.json({ ok: false, error: "Unsupported landing path" }, { status: 400 });
  }

  await persistAnalyticsEventAdmin({
    eventName: ANALYTICS_EVENTS.landing_view,
    source: ANALYTICS_SOURCES.recommended_landing,
    pagePath: target.sourcePath,
    sourcePath: target.sourcePath,
    landingSlug: target.landingSlug,
    templateType: target.templateType,
    metadata: {
      funnel: "kakao_sync",
      landingKind: target.templateType,
      ingest: "middleware",
      utm_source: str(body.utm_source),
      utm_medium: str(body.utm_medium),
      utm_campaign: str(body.utm_campaign),
      utm_term: str(body.utm_term),
      utm_content: str(body.utm_content),
      userAgent: str(body.userAgent),
    },
  });

  return NextResponse.json({ ok: true });
}
