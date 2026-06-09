import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import {
  getPresetPermissions,
  sanitizeSubAdminPermissions,
  type AdminPermissionKey,
  type AdminRolePresetId,
} from "@/lib/adminPermissions";
import { deactivateAdminUser, updateAdminUser } from "@/lib/adminUsers";

type UpdateBody = {
  displayName?: string;
  rolePreset?: AdminRolePresetId;
  permissions?: AdminPermissionKey[];
  password?: string;
  isActive?: boolean;
};

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("admin_users.manage");
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json()) as UpdateBody;

  let permissions = body.permissions;
  if (body.rolePreset && body.rolePreset !== "custom") {
    permissions = getPresetPermissions(body.rolePreset);
  } else if (permissions) {
    permissions = sanitizeSubAdminPermissions(permissions);
  }

  try {
    const user = await updateAdminUser(id, {
      displayName: body.displayName,
      rolePreset: body.rolePreset,
      permissions,
      password: body.password,
      isActive: body.isActive,
    });
    return NextResponse.json(user);
  } catch (e) {
    const message = e instanceof Error ? e.message : "관리자 계정 수정에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("admin_users.manage");
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  try {
    await deactivateAdminUser(id);
    return NextResponse.json({ message: "비활성화되었습니다." });
  } catch (e) {
    const message = e instanceof Error ? e.message : "관리자 계정 비활성화에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
