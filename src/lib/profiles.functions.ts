import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const membershipSchema = z.object({
  name: z.string().optional(), badge: z.string().nullable().optional(),
  priority_support: z.boolean().optional(), featured: z.boolean().optional(),
  featured_interval: z.string().optional(), max_active_auctions: z.number().nullable().optional(),
  referral_pct: z.number().optional(), ends_at: z.string().optional(),
});
const profileSchema = z.object({
  id: z.string(), display_name: z.string(), country: z.string().nullable(),
  city: z.string().nullable(), bio: z.string().nullable(), created_at: z.string(),
  membership: membershipSchema, rating: z.number().nullable(), review_count: z.number(),
  reviews: z.array(z.object({rating: z.number(), comment: z.string().nullable(), created_at: z.string()})),
});
export const getPublicProfile = createServerFn({method: "GET"})
  .inputValidator((data: {id: string}) => z.object({id: z.string().uuid()}).parse(data))
  .handler(async ({data}) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) throw new Error("No se pudo consultar el perfil");
    const client = createClient<Database>(url, key, {
      auth: {persistSession: false, autoRefreshToken: false},
      global: {fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, {...init, headers});
      }},
    });
    const result = await client.rpc("public_user_profile", {_user: data.id});
    if (result.error) throw new Error("No se pudo consultar el perfil");
    return result.data ? profileSchema.parse(result.data) : null;
  });
export const getMyMembership = createServerFn({method: "POST"})
  .middleware([requireSupabaseAuth])
  .handler(async ({context}) => {
    const result = await context.supabase.rpc("my_membership_benefits");
    if (result.error) throw new Error("No se pudo consultar tu membresía");
    return membershipSchema.parse(result.data);
  });
export const listMyPublications = createServerFn({method: "POST"})
  .middleware([requireSupabaseAuth])
  .handler(async ({context}) => {
    const result = await context.supabase.rpc("my_publications");
    if (result.error) throw new Error("No se pudieron cargar tus publicaciones");
    return z.array(z.object({
      id: z.string(), title: z.string(), status: z.string(), current_price: z.number().nullable(),
      currency: z.string(), bid_count: z.number(), ends_at: z.string().nullable(), auction_type: z.string(),
      closing_mode: z.string(), winner_id: z.string().nullable(), selection_pending: z.boolean(),
      extension_pending: z.boolean(), extension_used: z.boolean(), republished_from: z.string().nullable(), created_at: z.string(),
    })).parse(result.data);
  });