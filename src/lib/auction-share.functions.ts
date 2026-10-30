import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const getAuctionShare = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) throw new Error("No se pudo consultar la subasta");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const result = await client.from("auctions_safe").select("title,description,auction_type,images,status").eq("id", data.id).neq("status", "draft").maybeSingle();
    if (result.error) throw new Error("No se pudo consultar la subasta");
    if (!result.data?.title) return null;
    const a = result.data;
    return {
      title: a.title,
      // Never distribute private service descriptions or locations in social previews.
      description: a.auction_type === "item" ? (a.description || "Artículo en subasta en NEXO.").replace(/\s+/g, " ").slice(0, 240) : "Solicitud de servicio en NEXO. Consulta las condiciones de participación.",
      image: a.auction_type === "item" && Boolean(a.images?.[0]),
    };
  });