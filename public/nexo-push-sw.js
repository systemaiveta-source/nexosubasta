/* Messaging only. No caching, offline bidding or Firebase dependency. */
function destination(value) {
  return /^\/(subastas|operaciones)\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    value || "",
  )
    ? value
    : "/notificaciones";
}
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json() || {};
  } catch {
    data = {};
  }
  const path = destination(data.path);
  event.waitUntil(
    self.registration.showNotification(data.title || "NEXO", {
      body: data.body || "Nueva subasta en NEXO",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-64.png",
      tag: typeof data.tag === "string" ? data.tag : path,
      ...(typeof data.image === "string" &&
      data.image.startsWith("https://nexosubastas.com/api/public/subastas/")
        ? { image: data.image }
        : {}),
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
        await existing.navigate(target);
        await existing.focus();
      } else await self.clients.openWindow(target);
    })(),
  );
});
