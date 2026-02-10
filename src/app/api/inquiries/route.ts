import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { notifyInquiryCreated } from "@/lib/notifications";
import { createNewInquiryNotification } from "@/lib/adminNotifications";
import type { InquiryInput } from "@/types/inquiry";

export async function GET() {
  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ message: "문의 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const normalized = (data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    content: String(row.content ?? ""),
    product_id: typeof row.product_id === "string" ? row.product_id : undefined,
    product_title: typeof row.product_title === "string" ? row.product_title : undefined,
    source_path: typeof row.source_path === "string" ? row.source_path : undefined,
    is_completed: typeof row.is_completed === "boolean" ? row.is_completed : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  }));

  return NextResponse.json(normalized);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<InquiryInput>;
  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const content = body.content?.trim();
  const productId = body.product_id?.trim();
  const productTitle = body.product_title?.trim();
  const sourcePath = body.source_path?.trim();

  if (!name || !phone || !content) {
    return NextResponse.json({ message: "이름, 연락처, 문의 내용은 필수입니다." }, { status: 400 });
  }

  const insertResultWithProduct = await supabase
    .from("inquiries")
    .insert({
      name,
      phone,
      content,
      product_id: productId || null,
      product_title: productTitle || null,
      source_path: sourcePath || null,
    })
    .select("id")
    .maybeSingle();

  let inquiryId = insertResultWithProduct.data?.id;
  if (insertResultWithProduct.error || !insertResultWithProduct.data) {
    const insertLegacy = await supabase
      .from("inquiries")
      .insert({
        name,
        phone,
        content,
      })
      .select("id")
      .maybeSingle();
    if (insertLegacy.error || !insertLegacy.data) {
      return NextResponse.json({ message: "문의 저장에 실패했습니다." }, { status: 500 });
    }
    inquiryId = insertLegacy.data.id;
  }

  await notifyInquiryCreated({ name, phone, content });
  await createNewInquiryNotification({
    inquiryId: String(inquiryId),
    name,
    phone,
    content,
  });

  return NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 });
}
