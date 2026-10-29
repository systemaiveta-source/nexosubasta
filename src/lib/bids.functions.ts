import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const listMyBids = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bids = await context.supabase
      .from("bids")
      .select("id,auction_id,amount,conditions,created_at")
      .eq("bidder_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (bids.error) throw new Error("No se pudieron cargar tus ofertas");
    const ids = Array.from(new Set(bids.data.map((b) => b.auction_id)));
    if (!ids.length) return [];
    const auctions = await context.supabase
      .from("auctions_safe")
      .select("id,title,currency,status,auction_type,winner_id,leader_id,selection_pending")
      .in("id", ids);
    if (auctions.error) throw new Error("No se pudieron cargar las subastas");
    return bids.data.map((b) => ({
      ...b,
      auction: auctions.data.find((a) => a.id === b.auction_id) ?? null,
      isLeader: auctions.data.some((a) => a.id === b.auction_id && a.leader_id === context.userId),
    }));
  });
