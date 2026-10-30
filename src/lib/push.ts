import { safeDestination } from "./destinations";
export type PushConfig = { apiKey: string; projectId: string; appId: string; vapidKey: string };
export function pushConfigured(config: PushConfig) {
  return Boolean(
    config.apiKey && config.projectId && config.appId?.split(":")[1] && config.vapidKey,
  );
}
export function auctionPushPath(id: string) {
  const path = `/subastas/${id}`;
  return safeDestination(path);
}
export async function registerPush(config: PushConfig) {
  if (!pushConfigured(config))
    throw new Error(
      "Push pendiente de configuración: conecta Firebase con la opción Include web push; no se solicitó permiso.",
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
  const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Este navegador no admite push web.");
  const firebaseConfig = {
    apiKey: config.apiKey,
    projectId: config.projectId,
    appId: config.appId,
    messagingSenderId: config.appId.split(":")[1] ?? "",
  };
  const { initializeApp, getApps } = await import("firebase/app");
  const app =
    getApps().find((entry) => entry.name === "nexo-push") ??
    initializeApp(firebaseConfig, "nexo-push");
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig)}`,
  );
  const token = await getToken(getMessaging(app), {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("No se pudo registrar este dispositivo.");
  return token;
}
