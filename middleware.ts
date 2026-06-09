import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/adminAuth";
import {
  getDefaultLandingPathForSession,
  isInquiriesApiPath,
  isSessionAllowedForApiPath,
} from "@/lib/adminRolePolicy";
import { verifyAdminSessionToken } from "@/lib/adminSession";

const LEGACY_ADMIN_PREFIX = "/admin";
const MANAGER_PREFIX = "/theall_manager_only";
const MANAGER_LOGIN_PATH = `${MANAGER_PREFIX}/login`;

async function getAdminSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_AUTH_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
        return NextResponse.redirect(new URL(getDefaultLandingPathForSession(session), request.url));
      }
    } else if (!authenticated) {
      return NextResponse.redirect(new URL(MANAGER_LOGIN_PATH, request.url));
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
  ],
};
