import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/adminAuth";

const LEGACY_ADMIN_PREFIX = "/admin";
const MANAGER_PREFIX = "/theall_manager_only";
const MANAGER_LOGIN_PATH = `${MANAGER_PREFIX}/login`;
const MANAGER_INQUIRIES_PATH = `${MANAGER_PREFIX}/inquiries`;

function isAuthenticated(request: NextRequest) {
  return request.cookies.get(ADMIN_AUTH_COOKIE)?.value === "1";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);

  if (pathname === LEGACY_ADMIN_PREFIX || pathname.startsWith(`${LEGACY_ADMIN_PREFIX}/`)) {
    const redirectedUrl = request.nextUrl.clone();
    redirectedUrl.pathname = pathname.replace(LEGACY_ADMIN_PREFIX, MANAGER_PREFIX);
    return NextResponse.redirect(redirectedUrl);
  }

  const isManagerPath = pathname === MANAGER_PREFIX || pathname.startsWith(`${MANAGER_PREFIX}/`);

  if (isManagerPath) {
    if (pathname === MANAGER_LOGIN_PATH) {
      if (authenticated) {
        return NextResponse.redirect(new URL(MANAGER_INQUIRIES_PATH, request.url));
      }
    } else if (!authenticated) {
      return NextResponse.redirect(new URL(MANAGER_LOGIN_PATH, request.url));
    }
  }

  if (pathname.startsWith("/api/admin")) {
    const isAuthPath = pathname === "/api/admin/login" || pathname === "/api/admin/logout";
    if (!isAuthPath && !authenticated) {
      return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
    }
  }

  if (pathname === "/api/inquiries" && request.method === "GET" && !authenticated) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (pathname === "/api/inquiries" && request.method === "PATCH" && !authenticated) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (pathname.startsWith("/api/inquiries/") && request.method === "PATCH" && !authenticated) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
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
    "/reviews/write",
    "/api/reviews",
    "/api/reviews/:path*",
  ],
};
