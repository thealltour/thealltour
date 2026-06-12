import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getSmsTemplateById } from "@/lib/sms/smsTemplates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const item = await getSmsTemplateById(id);
  if (!item) return NextResponse.json({ message: "템플릿을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.body === "string") updates.body = body.body.trim();
  if (typeof body.category === "string") updates.category = body.category.trim();
  if (Array.isArray(body.variables)) updates.variables = body.variables;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

  const { error } = await supabaseAdmin.from("sms_templates").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: "템플릿 수정에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const { error } = await supabaseAdmin.from("sms_templates").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ message: "템플릿 비활성화에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
