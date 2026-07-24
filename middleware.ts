import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/adminAuth";
import { sanitizeAdminReturnTo } from "@/lib/adminConsolePaths";
import {
  getDefaultLandingPathForSession,
  isInquiriesApiPath,
  isSessionAllowedForApiPath,
} from "@/lib/adminRolePolicy";
import { resolveAdminSessionFromRequestToken } from "@/lib/adminSessionEdge";
import {
  KAKAO_SYNC_LANDING_VIEW_COOKIE,
  resolveKakaoSyncLandingHitTarget,
  shouldSkipLandingHitRequest,
} from "@/lib/analytics/kakaoSyncLandingHit";

const LEGACY_ADMIN_PREFIX = "/admin";
const MANAGER_PREFIX = "/theall_manager_only";
const MANAGER_LOGIN_PATH = `${MANAGER_PREFIX}/login`;

async function getAdminSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_AUTH_COOKIE)?.value;
  return resolveAdminSessionFromRequestToken(token);
}

function fireKakaoSyncLandingHit(request: NextRequest, event: NextFetchEvent): void {
  if (shouldSkipLandingHitRequest(request)) return;

  const target = resolveKakaoSyncLandingHitTarget(request.nextUrl.pathname);
  if (!target) return;

  const sp = request.nextUrl.searchParams;
  const hitUrl = new URL("/api/analytics/landing-hit", request.url);
  const payload = JSON.stringify({
    pathname: target.sourcePath,
    sourcePath: target.sourcePath,
    landingSlug: target.landingSlug,
    templateType: target.templateType,
    utm_source: sp.get("utm_source"),
    utm_medium: sp.get("utm_medium"),
    utm_campaign: sp.get("utm_campaign"),
    utm_term: sp.get("utm_term"),
    utm_content: sp.get("utm_content"),
    userAgent: request.headers.get("user-agent"),
  });

  const task = fetch(hitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  }).catch(() => {
    // fire-and-forget
  });

  event.waitUntil(task);
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  const golfTarget = resolveKakaoSyncLandingHitTarget(pathname);
  if (golfTarget) {
    fireKakaoSyncLandingHit(request, event);
    const response = NextResponse.next();
    response.cookies.set(KAKAO_SYNC_LANDING_VIEW_COOKIE, "1", {
      path: golfTarget.sourcePath,
      maxAge: 60 * 30,
      sameSite: "lax",
      httpOnly: false,
    });
    return response;
  }

  const session = await getAdminSession(request);
  const authenticated = session !== null;

  if (pathname === LEGACY_ADMIN_PREFIX || pathname.startsWith(`${LEGACY_ADMIN_PREFIX}/`)) {
    const redirectedUrl = request.nextUrl.clone();
    redirectedUrl.pathname = pathname.replace(LEGACY_ADMIN_PREFIX, MANAGER_PREFIX);
    return NextResponse.redirect(redirectedUrl);
  }

  const isManagerPath = pathname === MANAGER_PREFIX || pathname.startsWith(`${MANAGER_PREFIX}/`);

  if (isManagerPath) {
    if (pathname === MANAGER_LOGIN_PATH) {
      if (authenticated && session) {
        const next = sanitizeAdminReturnTo(request.nextUrl.searchParams.get("next"));
        const destination = next ?? getDefaultLandingPathForSession(session);
        return NextResponse.redirect(new URL(destination, request.url));
      }
    } else if (!authenticated) {
      const loginUrl = new URL(MANAGER_LOGIN_PATH, request.url);
      const returnTo = `${pathname}${request.nextUrl.search}`;
      loginUrl.searchParams.set("next", returnTo);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/api/admin")) {
    const isAuthPath = pathname === "/api/admin/login" || pathname === "/api/admin/logout";
    if (!isAuthPath) {
      if (!authenticated || !session) {
        return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
      }
      if (!isSessionAllowedForApiPath(session, pathname)) {
        return NextResponse.json({ message: "이 작업에 대한 권한이 없습니다." }, { status: 403 });
      }
    }
  }

  if (isInquiriesApiPath(pathname) && !authenticated) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (isInquiriesApiPath(pathname) && session && !isSessionAllowedForApiPath(session, pathname)) {
    return NextResponse.json({ message: "이 작업에 대한 권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/theall_manager_only",
    "/admin/:path*",
    "/theall_manager_only/:path*",
    "/api/admin/:path*",
    "/api/inquiries",
    "/api/inquiries/:path*",
    "/golf/kakao-sync",
    "/golf/kakao-sync/:path*",
    "/golf/ads/:path*",
  ],
};
