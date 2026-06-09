import { createPasswordHash, verifyPassword } from "@/lib/password";
import {
  deriveLegacyRoleFromPreset,
  sanitizeSubAdminPermissions,
  type AdminPermissionKey,
  type AdminRolePresetId,
} from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminUserRow = {
  id: string;
  username: string;
  display_name: string | null;
  role_preset: string;
  permissions: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserPublic = Omit<AdminUserRow, never>;

function mapRow(row: Record<string, unknown>): AdminUserRow {
  return {
    id: String(row.id),
    username: String(row.username),
    display_name: row.display_name != null ? String(row.display_name) : null,
    role_preset: String(row.role_preset ?? "custom"),
    permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
    is_active: Boolean(row.is_active),
    last_login_at: row.last_login_at != null ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listAdminUsers(): Promise<AdminUserPublic[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,username,display_name,role_preset,permissions,is_active,last_login_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function findAdminUserByUsername(username: string): Promise<
  | (AdminUserRow & { password_hash: string; password_salt: string })
  | null
> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("*")
    .eq("username", username.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...mapRow(row),
    password_hash: String(row.password_hash),
    password_salt: String(row.password_salt),
  };
}

export async function verifyAdminUserCredentials(
  username: string,
  password: string,
): Promise<AdminUserRow | null> {
  const user = await findAdminUserByUsername(username);
  if (!user) return null;
  const ok = verifyPassword(password, user.password_salt, user.password_hash);
  if (!ok) return null;

  await supabaseAdmin
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", user.id);

  const { password_hash: _h, password_salt: _s, ...publicUser } = user;
  return publicUser;
}

export type CreateAdminUserInput = {
  username: string;
  password: string;
  displayName?: string;
  rolePreset: AdminRolePresetId;
  permissions: AdminPermissionKey[];
};

export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminUserPublic> {
  const { hash, salt } = createPasswordHash(input.password);
  const permissions = sanitizeSubAdminPermissions(input.permissions);
  const rolePreset = input.rolePreset === "custom" ? "custom" : input.rolePreset;

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .insert({
      username: input.username.trim(),
      display_name: input.displayName?.trim() || null,
      password_hash: hash,
      password_salt: salt,
      role_preset: rolePreset,
      permissions,
      is_active: true,
    })
    .select("id,username,display_name,role_preset,permissions,is_active,last_login_at,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export type UpdateAdminUserInput = {
  displayName?: string;
  rolePreset?: AdminRolePresetId;
  permissions?: AdminPermissionKey[];
  password?: string;
  isActive?: boolean;
};

export async function updateAdminUser(id: string, input: UpdateAdminUserInput): Promise<AdminUserPublic> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.displayName !== undefined) patch.display_name = input.displayName.trim() || null;
  if (input.rolePreset !== undefined) patch.role_preset = input.rolePreset;
  if (input.permissions !== undefined) patch.permissions = sanitizeSubAdminPermissions(input.permissions);
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.password?.trim()) {
    const { hash, salt } = createPasswordHash(input.password);
    patch.password_hash = hash;
    patch.password_salt = salt;
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .update(patch)
    .eq("id", id)
    .select("id,username,display_name,role_preset,permissions,is_active,last_login_at,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deactivateAdminUser(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("admin_users")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export { deriveLegacyRoleFromPreset };
