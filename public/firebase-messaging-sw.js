/* Messaging only: no app-shell cache or offline bidding. */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
const config = Object.fromEntries(new URL(self.location).searchParams);
function auctionPath(value) {
  return /^\/subastas\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    value || "",
  )
    ? value
    : "/notificaciones";
}
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = auctionPath(event.notification.data?.path);
  const target = new URL(path, self.location.origin).href;
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
if (config.apiKey && config.projectId && config.appId && config.messagingSenderId) {
  firebase.initializeApp(config);
  firebase.messaging().onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const path = auctionPath(data.path);
    let image;
    try {
      const url = new URL(data.image);
      if (url.protocol === "https:") image = url.href;
    } catch {
      /* no thumbnail */
    }
    return self.registration.showNotification(data.title || "NEXO", {
      body: data.body || "Nueva subasta",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-64.png",
      ...(image ? { image } : {}),
      tag: path,
      renotify: false,
      data: { path },
    });
  });
}
