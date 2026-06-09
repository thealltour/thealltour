import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import {
  getPresetPermissions,
  sanitizeSubAdminPermissions,
  type AdminPermissionKey,
  type AdminRolePresetId,
} from "@/lib/adminPermissions";
import { createAdminUser, listAdminUsers } from "@/lib/adminUsers";

type CreateBody = {
  username?: string;
  password?: string;
  displayName?: string;
  rolePreset?: AdminRolePresetId;
  permissions?: AdminPermissionKey[];
};

export async function GET() {
  const auth = await requireAdminPermission("admin_users.manage");
  if (!auth.ok) return auth.res;

  try {
    const users = await listAdminUsers();
    return NextResponse.json(users);
  } catch (e) {
    const message = e instanceof Error ? e.message : "관리자 목록 조회에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("admin_users.manage");
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as CreateBody;
  const username = body.username?.trim();
  const password = body.password?.trim();
  const rolePreset = body.rolePreset ?? "custom";

  if (!username || !password) {
    return NextResponse.json({ message: "아이디와 비밀번호는 필수입니다." }, { status: 400 });
  }

  if (username.length < 3) {
    return NextResponse.json({ message: "아이디는 3자 이상이어야 합니다." }, { status: 400 });
  }

  const permissions =
    rolePreset !== "custom"
      ? getPresetPermissions(rolePreset)
      : sanitizeSubAdminPermissions(body.permissions ?? []);

  if (permissions.length === 0) {
    return NextResponse.json({ message: "최소 1개 이상의 권한을 선택해 주세요." }, { status: 400 });
  }

  try {
    const user = await createAdminUser({
      username,
      password,
      displayName: body.displayName,
      rolePreset,
      permissions,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "관리자 계정 생성에 실패했습니다.";
    const status = message.includes("duplicate") || message.includes("unique") ? 409 : 500;
    return NextResponse.json({ message }, { status });
  }
}
