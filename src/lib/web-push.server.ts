import { buildPushPayload } from "@block65/webcrypto-web-push";
import { webPushSubscriptionSchema } from "./web-push-schema";
import { safeDestination } from "./destinations";
import { NEXO_ORIGIN, publicImageUrl } from "./site-url";

// Caller must already be authorized. Disabled until deployment/configuration is explicitly approved.
export async function deliverWebPushBatch() {
  const publicKey = process.env["NEXO_VAPID_PUBLIC_KEY"];
  const privateKey = process.env["NEXO_VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey || process.env["NEXO_PUSH_DELIVERY_ENABLED"] !== "true")
    throw new Error("Envíos push desactivados: falta configuración y autorización de activación");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const batch = await supabaseAdmin.rpc("claim_notification_push_batch", { _limit: 20 });
  if (batch.error) throw new Error("No se pudo obtener el lote");
  let sent = 0;
  for (const item of batch.data) {
    const parsed = webPushSubscriptionSchema.safeParse(item.subscription);
    const path = safeDestination(item.path);
    if (!parsed.success || !path) {
      await supabaseAdmin
        .from("notification_push_outbox")
        .update({ status: "skipped" })
        .eq("id", item.queue_id);
      continue;
    }
    try {
      const payload = await buildPushPayload(
        {
          data: JSON.stringify({
            title: `NEXO · ${item.title}`,
            body: `${item.body ?? "Aviso de NEXO"}${item.starting_price !== null ? ` · Precio inicial: ${item.starting_price} ${item.currency}` : ""}`,
            path,
            tag: `nexo-${item.notification_id}`,
            image: item.image_path && item.auction_id ? publicImageUrl(item.auction_id) : undefined,
          }),
          options: { ttl: 3600 },
        },
        {
          ...parsed.data,
          expirationTime: parsed.data.expirationTime ?? null,
        },
        { subject: NEXO_ORIGIN, publicKey, privateKey },
      );
      const response = await fetch(parsed.data.endpoint, { ...payload, redirect: "error" });
      if (response.status === 404 || response.status === 410)
        await supabaseAdmin.from("push_devices").update({ active: false }).eq("id", item.device_id);
      if (!response.ok) {
        // Endpoints and provider bodies may contain private subscription credentials.
        console.error(`Web Push rejected [${response.status}]`);
        await supabaseAdmin
          .from("notification_push_outbox")
          .update({ status: "failed" })
          .eq("id", item.queue_id);
        continue;
      }
      const recorded = await supabaseAdmin
        .from("notification_push_outbox")
        .update({ status: "sent" })
        .eq("id", item.queue_id);
      if (recorded.error) throw new Error("No se pudo registrar la entrega");
      sent++;
    } catch {
      await supabaseAdmin
        .from("notification_push_outbox")
        .update({ status: "failed" })
        .eq("id", item.queue_id);
    }
  }
  return { sent, attempted: batch.data.length };
}
