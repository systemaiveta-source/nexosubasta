import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { socialLinkSchema } from "./social-links";
import { z } from "zod";
export const listPublicSocialLinks = createServerFn({ method: "GET" }).handler(async () => {
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = process.env["SUPABASE_URL"] ?? import.meta.env.VITE_SUPABASE_URL;
  if (!key || !url) {
    console.error("social links: missing backend configuration");
    return [];
  }
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const result = await client
    .from("social_links")
    .select("id,network,label,url,sort")
    .eq("active", true)
    .order("sort")
    .order("id");
  if (result.error) {
    console.error("social links:", result.error.message);
    return [];
  }
  return result.data ?? [];
});
export const listAdminSocialLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("No autorizado");
    const result = await context.supabase
      .from("social_links")
      .select("*")
      .order("sort")
      .order("id");
    if (result.error) throw new Error("No se pudieron cargar las redes");
    return result.data;
  });
export const saveSocialLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => socialLinkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("No autorizado");
    const { id, ...rest } = data;
    const result = await context.supabase
      .from("social_links")
      .upsert({ ...rest, ...(id ? { id } : {}), updated_at: new Date().toISOString() });
    if (result.error) throw new Error("No se pudo guardar la red social");
    return { ok: true };
  });
export const deleteSocialLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("No autorizado");
    const result = await context.supabase.from("social_links").delete().eq("id", data.id);
    if (result.error) throw new Error("No se pudo eliminar la red social");
    return { ok: true };
  });
