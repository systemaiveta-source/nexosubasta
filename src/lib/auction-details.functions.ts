import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { deliverySchema } from "./delivery";
import { serviceRequestSchema } from "./service-catalog";
import type { Json } from "@/integrations/supabase/types";
import { auctionTimingSchema } from "./auction-timing";
export const saveExtendedDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string | null;
      auction: Record<string, unknown>;
      private: Record<string, unknown>;
      delivery: unknown;
      request: unknown;
    }) =>
      z
        .object({
          id: z.string().uuid().nullable(),
          auction: z.record(z.unknown()),
          private: z.record(z.unknown()),
          delivery: deliverySchema.nullable(),
          request: serviceRequestSchema.nullable(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const timing = auctionTimingSchema.parse(data.auction);
    if (
      timing.closing_mode === "reserve" &&
      (data.auction["auction_type"] !== "item" || !(Number(data.private["reserve_price"]) > 0))
    )
      throw new Error("La modalidad por objetivos exige reserva privada de producto");
    if (data.auction["auction_type"] === "item" && !data.delivery)
      throw new Error("Elige modalidad de entrega");
    if (data.auction["auction_type"] === "service" && !data.request)
      throw new Error("Completa los detalles del servicio");
    const result = await context.supabase.rpc("save_extended_draft", {
      ...(data.id ? { _id: data.id } : {}),
      _data: JSON.parse(JSON.stringify({ ...data.auction, ...timing })) as Json,
      _private: JSON.parse(JSON.stringify(data.private)) as Json,
      _delivery: data.delivery,
      _request: data.request,
    });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data };
  });
export const getServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("get_service_request", { _auction: data.id });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
