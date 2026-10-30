import { z } from "zod";

// Browser-issued delivery endpoints only; arbitrary URLs would expose server-side request forgery.
export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" || url.hostname === "wns.windows.com" || url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}
export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096).refine(allowedPushEndpoint, "Destino de notificaciones no permitido"),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87,88}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22,24}$/) }),
});
export type WebPushSubscription = z.infer<typeof webPushSubscriptionSchema>;