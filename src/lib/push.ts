import { safeDestination } from "./destinations";
export type PushConfig = { vapidKey: string };
export function pushConfigured(config: PushConfig) {
  return /^[A-Za-z0-9_-]{87}$/.test(config.vapidKey);
}
export function auctionPushPath(id: string) {
  const path = `/subastas/${id}`;
  return safeDestination(path);
}
export async function registerPush(config: PushConfig) {
  if (!pushConfigured(config))
    throw new Error(
      "Push pendiente de configuración segura de NEXO; no se solicitó permiso.",
    );
  if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator))
    throw new Error("Este navegador o dispositivo no admite notificaciones push.");
  if (window.top !== window.self)
    throw new Error("Abre NEXO en una pestaña propia para permitir notificaciones.");
  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Notificaciones bloqueadas. Puedes cambiar el permiso en los ajustes del navegador.",
    );
  if (!("PushManager" in window)) throw new Error("Este navegador no admite push web. En iPhone o iPad abre NEXO desde su icono instalado.");
  const registration = await navigator.serviceWorker.register(
    "/nexo-push-sw.js",
  );
  await navigator.serviceWorker.ready;
  const decoded = atob(config.vapidKey.replace(/-/g, "+").replace(/_/g, "/") + "=");
  const key = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  return subscription.toJSON();
}
