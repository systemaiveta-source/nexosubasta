import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { pushConfigured } from "./push";
import { webPushSubscriptionSchema } from "./web-push-schema";
export const getPushSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = {
      vapidKey: process.env["NEXO_VAPID_PUBLIC_KEY"] ?? "",
    };
    const configured = Boolean(pushConfigured(config) && process.env["NEXO_VAPID_PRIVATE_KEY"]);
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
        .eq("transport", "webpush")
        .eq("user_id", context.userId),
      context.supabase.from("categories").select("id,name").neq("slug", "nft-cripto").order("sort"),
    ]);
    if (preferences.error || devices.error || categories.error)
      throw new Error("No se pudieron cargar las preferencias");
    return {
      configured,
      deliveryEnabled: configured && process.env["NEXO_PUSH_DELIVERY_ENABLED"] === "true",
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
  .inputValidator((data: { subscription: unknown }) =>
    z.object({ subscription: webPushSubscriptionSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!process.env["NEXO_VAPID_PRIVATE_KEY"]) throw new Error("Push pendiente de configuración");
    const result = await context.supabase.from("push_devices").upsert(
      {
        user_id: context.userId,
        token: data.subscription.endpoint,
        transport: "webpush",
        subscription: data.subscription,
        active: true,
      },
      { onConflict: "token" },
    );
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
/** No UI auto-send: an authenticated administrator may dispatch only after runtime activation. */
export const dispatchPushBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("No autorizado");
    const { deliverWebPushBatch } = await import("./web-push.server");
    return deliverWebPushBatch();
  });
