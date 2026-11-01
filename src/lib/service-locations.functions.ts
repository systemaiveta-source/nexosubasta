import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function geocode(address: string): Promise<boolean> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("El servicio de mapas no está configurado");
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?language=es&address=${encodeURIComponent(address)}`,
    { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": mapsKey } },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error(`Geocoding failed [${res.status}]: ${body}`);
    throw new Error(`No se pudo validar la ubicación con Google Maps (${res.status})`);
  }
  const json = (await res.json()) as { status?: string; results?: unknown[] };
  return json.status === "OK" && (json.results?.length ?? 0) > 0;
}

/** Owner-only: validates transport origin/destination with Google Maps and stores the result. */
export const verifyServiceLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const owner = await context.supabase
      .from("auctions")
      .select("seller_id, auction_type")
      .eq("id", data.id)
      .maybeSingle();
    if (owner.error || !owner.data || owner.data.seller_id !== context.userId)
      throw new Error("No autorizado");
    if (owner.data.auction_type !== "service") return { status: "not_needed" as const };
    const req = await context.supabase.rpc("get_service_request", { _auction: data.id });
    if (req.error || !req.data) return { status: "not_needed" as const };
    const request = req.data as { category?: string; values?: Record<string, string> };
    if (request.category !== "transport") return { status: "not_needed" as const };
    const origin = (request.values?.["origin"] ?? "").trim().slice(0, 500);
    const destination = (request.values?.["destination"] ?? "").trim().slice(0, 500);
    const ok = origin.length > 3 && destination.length > 3 && (await geocode(origin)) && (await geocode(destination));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const upd = await supabaseAdmin.rpc("set_service_locations_verified", {
      _auction: data.id,
      _verified: ok,
    });
    if (upd.error) throw new Error("No se pudo guardar la validación");
    return { status: ok ? ("verified" as const) : ("not_found" as const) };
  });
