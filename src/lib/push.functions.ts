import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { auctionPushPath } from "./push";
export const getPushSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = {
      apiKey: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] ?? "",
      projectId: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] ?? "",
      appId: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] ?? "",
      vapidKey: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] ?? "",
    };
    const configured = Boolean(
      config.apiKey &&
      config.projectId &&
      config.appId &&
      config.vapidKey &&
      process.env["FIREBASE_MESSAGING_API_KEY"] &&
      process.env["LOVABLE_API_KEY"],
    );
    const [preferences, devices, categories] = await Promise.all([
      context.supabase
        .from("notification_preferences")
        .select("new_auctions,categories")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("push_devices")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .eq("user_id", context.userId),
      context.supabase.from("categories").select("id,name").neq("slug", "nft-cripto").order("sort"),
    ]);
    if (preferences.error || devices.error || categories.error)
      throw new Error("No se pudieron cargar las preferencias");
    return {
      configured,
      config,
      preferences: preferences.data ?? { new_auctions: false, categories: [] },
      devices: devices.count ?? 0,
      categories: categories.data,
    };
  });
export const savePushPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { enabled: boolean; categories: string[] }) =>
    z.object({ enabled: z.boolean(), categories: z.array(z.string().uuid()).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.from("notification_preferences").upsert({
      user_id: context.userId,
      new_auctions: data.enabled,
      categories: [...new Set(data.categories)],
      updated_at: new Date().toISOString(),
    });
    if (result.error) throw new Error("No se pudieron guardar tus preferencias");
    return { ok: true };
  });
export const registerPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().min(20).max(4096) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!process.env["FIREBASE_MESSAGING_API_KEY"])
      throw new Error("Push pendiente de configuración");
    const result = await context.supabase
      .from("push_devices")
      .upsert({ user_id: context.userId, token: data.token, active: true }, { onConflict: "token" });
    if (result.error) throw new Error("No se pudo registrar este dispositivo para tu cuenta");
    return { ok: true };
  });
export const disablePushDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase
      .from("push_devices")
      .update({ active: false })
      .eq("user_id", context.userId);
    if (result.error) throw new Error("No se pudieron desactivar los dispositivos");
    return { ok: true };
  });
/** Deliberately not scheduled or called by the UI: activation requires configured FCM and explicit authorization. */
export const dispatchPushBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("No autorizado");
    const key = process.env["FIREBASE_MESSAGING_API_KEY"];
    const authorization = process.env["LOVABLE_API_KEY"];
    if (!key || !authorization || process.env["NEXO_PUSH_DELIVERY_ENABLED"] !== "true")
      throw new Error("Envíos push desactivados: falta configuración y autorización de activación");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const batch = await supabaseAdmin.rpc("claim_push_batch", { _limit: 20 });
    if (batch.error) throw new Error("No se pudo obtener el lote");
    let sent = 0;
    for (const item of batch.data) {
      const path = auctionPushPath(item.auction_id);
      if (!path) {
        await supabaseAdmin
          .from("push_outbox")
          .update({ status: "skipped" })
          .eq("id", item.queue_id);
        continue;
      }
      const data: Record<string, string> = {
        title: item.title,
        body: `${item.category_name} · Nueva subasta en NEXO`,
        path,
      };
      if (item.image_path) {
        const signed = await supabaseAdmin.storage.from("auction-images").createSignedUrl(item.image_path, 7200);
        const image = signed.data?.signedUrl;
        const browserOrigin = process.env["VITE_SUPABASE_URL"];
        if (browserOrigin && image) {
          const url = new URL(image);
          const origin = new URL(browserOrigin);
          url.host = origin.host;
          url.protocol = origin.protocol;
          data["image"] = url.href;
        }
      }
      try {
        const response = await fetch(
          "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authorization}`,
              "X-Connection-Api-Key": key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: item.device_token,
                data,
                webpush: { headers: { TTL: "3600", Urgency: "normal" } },
              },
            }),
          },
        );
        if (!response.ok) {
          const errorBody = await response.text();
          // Do not log provider bodies containing device tokens; retain HTTP status and bounded failure category.
          console.error(`Push provider rejected delivery [${response.status}]`);
          if (response.status === 404 && errorBody.includes("UNREGISTERED"))
            await supabaseAdmin.from("push_devices").update({ active: false }).eq("id", item.device_id);
          await supabaseAdmin
            .from("push_outbox")
            .update({ status: "failed" })
            .eq("id", item.queue_id);
          continue;
        }
        await supabaseAdmin.from("push_outbox").update({ status: "sent" }).eq("id", item.queue_id);
        sent++;
      } catch {
        await supabaseAdmin
          .from("push_outbox")
          .update({ status: "failed" })
          .eq("id", item.queue_id);
      }
    }
    return { sent, attempted: batch.data.length };
  });
