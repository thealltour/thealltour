import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AdminSessionPermissions } from "@/lib/adminPermissions";
import { hasAdminPermission } from "@/lib/adminPermissions";

const MANAGER_PREFIX = "/theall_manager_only";

export type AdminGlobalSearchResultType = "inquiry" | "member" | "product";

export type AdminGlobalSearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type AdminGlobalSearchGroup = {
  type: AdminGlobalSearchResultType;
  label: string;
  items: AdminGlobalSearchItem[];
};

export type AdminGlobalSearchResponse = {
  q: string;
  groups: AdminGlobalSearchGroup[];
};

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

async function searchInquiries(q: string, limit: number): Promise<AdminGlobalSearchItem[]> {
  const escaped = escapeIlike(q);
  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .select("id,name,phone,product_title,consultation_status,created_at")
    .or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,content.ilike.%${escaped}%,product_title.ilike.%${escaped}%`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.name ?? "이름 없음"),
    subtitle: [row.phone, row.product_title].filter(Boolean).join(" · ") || "문의",
    href: `${MANAGER_PREFIX}/inquiries?search=${encodeURIComponent(q)}&highlight=${row.id}`,
  }));
}

async function searchMembers(q: string, limit: number): Promise<AdminGlobalSearchItem[]> {
  const escaped = escapeIlike(q);
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id,name,phone,email,username")
    .or(`email.ilike.%${escaped}%,phone.ilike.%${escaped}%,name.ilike.%${escaped}%,username.ilike.%${escaped}%`)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.name ?? row.username ?? "회원"),
    subtitle: [row.phone, row.email].filter(Boolean).join(" · ") || "회원",
    href: `${MANAGER_PREFIX}/members/${row.id}`,
  }));
}

async function searchProducts(q: string, limit: number): Promise<AdminGlobalSearchItem[]> {
  const escaped = escapeIlike(q);
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id,title,category,destination")
    .or(`title.ilike.%${escaped}%,category.ilike.%${escaped}%,destination.ilike.%${escaped}%`)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "상품"),
    subtitle: [row.category, row.destination].filter(Boolean).join(" · ") || "상품",
    href: `${MANAGER_PREFIX}/products?q=${encodeURIComponent(q)}`,
  }));
}

export async function runAdminGlobalSearch(input: {
  q: string;
  types: AdminGlobalSearchResultType[];
  limit: number;
  session: AdminSessionPermissions;
}): Promise<AdminGlobalSearchResponse> {
  const q = input.q.trim();
  const limit = Math.min(Math.max(input.limit, 1), 10);
  const groups: AdminGlobalSearchGroup[] = [];

  if (!q) {
    return { q, groups };
  }

  const tasks: Promise<void>[] = [];

  if (input.types.includes("inquiry") && hasAdminPermission(input.session, "inquiries.manage")) {
    tasks.push(
      searchInquiries(q, limit).then((items) => {
        if (items.length > 0) {
          groups.push({ type: "inquiry", label: "문의", items });
        }
      }),
    );
  }

  if (input.types.includes("member") && hasAdminPermission(input.session, "members.manage")) {
    tasks.push(
      searchMembers(q, limit).then((items) => {
        if (items.length > 0) {
          groups.push({ type: "member", label: "회원", items });
        }
      }),
    );
  }

  if (input.types.includes("product") && hasAdminPermission(input.session, "products.manage")) {
    tasks.push(
      searchProducts(q, limit).then((items) => {
        if (items.length > 0) {
          groups.push({ type: "product", label: "상품", items });
        }
      }),
    );
  }

  await Promise.all(tasks);

  const order: AdminGlobalSearchResultType[] = ["inquiry", "member", "product"];
  groups.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  return { q, groups };
}
