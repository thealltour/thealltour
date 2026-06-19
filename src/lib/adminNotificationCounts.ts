import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getUnreadNotificationCount() {
  const result = await supabaseAdmin
    .from("admin_notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  if (result.error) return 0;
  return result.count ?? 0;
}
