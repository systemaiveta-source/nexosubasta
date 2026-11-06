import { buildPushPayload } from "@block65/webcrypto-web-push";
import { webPushSubscriptionSchema } from "./web-push-schema";
import { safeDestination } from "./destinations";
import { NEXO_ORIGIN, publicImageUrl } from "./site-url";
import { retryPush, pushFailureStage } from "./push-delivery";

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
    let stage: "payload" | "network" | "record" = "payload";
    async function recordFailure(reason: string, retry: boolean) {
      const current = await supabaseAdmin.from("notification_push_outbox").select("attempts").eq("id", item.queue_id).single();
      const attempts = current.data?.attempts ?? 3;
      await supabaseAdmin.from("notification_push_outbox").update({
        status: retry && attempts < 3 ? "pending" : "failed", last_error: reason,
        next_attempt_at: new Date(Date.now() + Math.min(attempts, 3) * 60000).toISOString(),
      }).eq("id", item.queue_id);
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
      stage = "network";
      const response = await fetch(parsed.data.endpoint, { ...payload, redirect: "error", signal: AbortSignal.timeout(15000) });
      if (response.status === 404 || response.status === 410)
        await supabaseAdmin.from("push_devices").update({ active: false }).eq("id", item.device_id);
      if (!response.ok) {
        // Endpoints and provider bodies may contain private subscription credentials.
        console.error(`Web Push rejected [${response.status}]`);
        await recordFailure(`http ${response.status}`, retryPush(response.status));
        continue;
      }
      stage = "record";
      const recorded = await supabaseAdmin
        .from("notification_push_outbox")
        .update({ status: "sent", last_error: null })
        .eq("id", item.queue_id);
      if (recorded.error) throw new Error("No se pudo registrar la entrega");
      sent++;
    } catch {
      await recordFailure(pushFailureStage(stage), stage === "network");
    }
  }
  return { sent, attempted: batch.data.length };
}
