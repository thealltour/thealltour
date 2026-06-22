import { NextResponse } from "next/server";
import {
  ADMIN_AUTH_COOKIE,
  hasBootstrapAdminConfigured,
  isBootstrapAdminCredentials,
} from "@/lib/adminAuth";
import { sanitizeAdminReturnTo } from "@/lib/adminConsolePaths";
import { getDefaultLandingPathForSession } from "@/lib/adminRolePolicy";
import { deriveLegacyRoleFromPermissions } from "@/lib/adminPermissions";
import { ADMIN_SESSION_COOKIE_MAX_AGE_SEC } from "@/lib/adminSessionPolicy";
import { createAdminSessionWithToken } from "@/lib/adminSessionStore";
import { deriveLegacyRoleFromPreset, verifyAdminUserCredentials } from "@/lib/adminUsers";

type LoginBody = {
  id?: string;
  password?: string;
  next?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const id = body.id?.trim();
  const password = body.password?.trim();
  const safeNext = sanitizeAdminReturnTo(body.next);

  if (!hasBootstrapAdminConfigured()) {
    return NextResponse.json(
      { message: "서버에 총괄 관리자 로그인 자격(ADMIN_ID/ADMIN_PASSWORD)이 설정되어 있지 않습니다." },
      { status: 500 },
    );
  }

  if (!id || !password) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  let sessionPayload;

  if (isBootstrapAdminCredentials(id, password)) {
    sessionPayload = {
      role: "admin" as const,
      permissions: ["*"],
      isBootstrapAdmin: true,
      username: id,
    };
  } else {
    const user = await verifyAdminUserCredentials(id, password);
    if (!user) {
      return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const role = deriveLegacyRoleFromPermissions(user.permissions, false);
    sessionPayload = {
      role: role ?? deriveLegacyRoleFromPreset(user.role_preset),
      permissions: user.permissions,
      isBootstrapAdmin: false,
      adminUserId: user.id,
      username: user.username,
    };
  }

  let token: string;
  try {
    const created = await createAdminSessionWithToken(sessionPayload, {
      userAgent: request.headers.get("user-agent"),
    });
    token = created.token;
  } catch (e) {
    const message = e instanceof Error ? e.message : "관리자 세션을 발급할 수 없습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }

  const response = NextResponse.json({
    message: "로그인되었습니다.",
    role: sessionPayload.role,
    redirectTo: safeNext ?? getDefaultLandingPathForSession(sessionPayload),
  });
  response.cookies.set(ADMIN_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_COOKIE_MAX_AGE_SEC,
  });

  return response;
}
