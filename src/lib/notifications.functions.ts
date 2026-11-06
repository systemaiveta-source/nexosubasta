import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: { page: number; unreadOnly: boolean }) =>
    z.object({ page: z.number().int().min(0).max(100000), unreadOnly: z.boolean() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("notifications")
      .select("id,title,body,link,read,created_at", { count: "exact" })
      .eq("user_id", context.userId);
    if (data.unreadOnly) query = query.eq("read", false);
    const result = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(data.page * 20, data.page * 20 + 19);
    if (result.error) throw new Error("No se pudieron cargar tus notificaciones");
    const readCount = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("read", true);
    if (readCount.error) throw new Error("No se pudo contar las notificaciones leídas");
    return { rows: result.data, total: result.count ?? 0, readTotal: readCount.count ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: { id?: string }) =>
    z.object({ id: z.string().uuid().optional() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", context.userId)
      .eq("read", false);
    if (data.id) query = query.eq("id", data.id);
    const result = await query;
    if (result.error) throw new Error("No se pudo actualizar la notificación");
    return { ok: true };
  });

export const deleteReadNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: { id?: string }) =>
    z.object({ id: z.string().uuid().optional() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc(
      "delete_read_notifications",
      data.id ? { _id: data.id } : {},
    );
    if (result.error) throw new Error("No se pudieron borrar las notificaciones leídas");
    return { removed: result.data };
  });
