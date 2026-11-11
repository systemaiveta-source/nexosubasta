/* Messaging only. No caching, offline bidding or Firebase dependency. */
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
function destination(value) {
  return /^\/(subastas|operaciones)\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    value || "",
  )
    ? value
    : "/notificaciones";
}
function thumbnail(value) {
  try {
    const url = new URL(value);
    const allowed = [self.location.origin, "https://nexosubastas.com", "https://www.nexosubastas.com", "https://nexosubasta.lovable.app"];
    return allowed.includes(url.origin) && !url.search && !url.hash && /^\/api\/public\/subastas\/[a-f0-9-]{36}\/miniatura$/i.test(url.pathname) ? url.href : undefined;
  } catch { return undefined; }
}
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json() || {};
  } catch {
    data = {};
  }
  const path = destination(data.path);
  const image = thumbnail(data.image);
  event.waitUntil(
    self.registration.showNotification(data.title || "NEXO", {
      body: data.body || "Nueva subasta en NEXO",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-64.png",
      tag: typeof data.tag === "string" ? data.tag : path,
      ...(image ? { image } : {}),
      // Let the operating system play its default notification sound where supported.
      silent: false,
      vibrate: [250, 100, 250],
      data: { path },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(destination(event.notification.data?.path), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        try {
          const navigated = await existing.navigate(target);
          await (navigated || existing).focus();
        } catch { await self.clients.openWindow(target); }
      } else await self.clients.openWindow(target);
    })(),
  );
});
