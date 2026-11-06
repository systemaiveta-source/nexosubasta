import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const Route = createFileRoute("/api/public/subastas/$id/miniatura")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!z.string().uuid().safeParse(params.id).success)
          return new Response(null, { status: 404 });
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const url = process.env["SUPABASE_URL"];
        if (!key || !url) return new Response(null, { status: 503 });
        const client = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
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
        const { data, error } = await client
          .from("auctions_safe")
          .select("images,auction_type")
          .eq("id", params.id)
          .neq("status", "draft")
          .maybeSingle();
        if (error) return new Response(null, { status: 503 });
        if (data?.auction_type !== "item" || !data.images?.[0])
          return new Response(null, { status: 404 });
        // Path comes exclusively from the public projection, never request parameters or private buckets.
        const image = await client.storage.from("auction-images").download(data.images[0]);
        if (image.error || !image.data || image.data.size > 8 * 1024 * 1024)
          return new Response(null, { status: 404 });
        try {
          const bytes = new Uint8Array(await image.data.arrayBuffer());
          const { imageSize } = await import("image-size");
          const dimensions = imageSize(bytes);
          if (
            !dimensions.width ||
            !dimensions.height ||
            dimensions.width * dimensions.height > 12_000_000 ||
            !["jpg", "png", "webp"].includes(dimensions.type || "")
          )
            return new Response(null, { status: 422 });
          // Serve the original public photo (worker-safe, no image codecs bundled).
          const type = dimensions.type === "jpg" ? "image/jpeg" : `image/${dimensions.type}`;
          return new Response(bytes, {
            headers: {
              "Content-Type": type,
              "Cache-Control": "public, max-age=300",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          return new Response(null, { status: 422 });
        }
      },
    },
  },
});
