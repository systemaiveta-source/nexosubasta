import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
function worker(windows: unknown[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync("public/nexo-push-sw.js", "utf8"), {
    URL,
    self: {
      location: { origin: "https://nexosubastas.com" },
      registration: { showNotification },
      skipWaiting: vi.fn().mockResolvedValue(undefined),
      clients: { claim, openWindow, matchAll: vi.fn().mockResolvedValue(windows) },
      addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; },
    },
  });
  async function dispatch(name: string, fields: object) {
    let done = Promise.resolve();
    handlers[name]?.({ ...fields, waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
  }
  return { dispatch, showNotification, openWindow, claim };
}
it("shows a background notification without an image or open client", async () => {
  const w = worker();
  await w.dispatch("push", { data: { json: () => ({title:"Puja", path:`/subastas/${id}`}) } });
  expect(w.showNotification).toHaveBeenCalledWith("Puja", expect.objectContaining({ badge:"/icons/icon-64.png", data:{path:`/subastas/${id}`} }));
  expect(w.showNotification.mock.calls[0]?.[1]).not.toHaveProperty("image");
});
it("rejects external images and external click destinations", async () => {
  const w = worker();
  await w.dispatch("push", { data: { json: () => ({image:`https://evil.example/api/public/subastas/${id}/miniatura`}) } });
  expect(w.showNotification.mock.calls[0]?.[1]).not.toHaveProperty("image");
  await w.dispatch("notificationclick", { notification:{close:vi.fn(), data:{path:"https://evil.example"}} });
  expect(w.openWindow).toHaveBeenCalledWith("https://nexosubastas.com/notificaciones");
});
it.each(["subastas", "operaciones"])("opens the exact %s destination from a closed app", async kind => {
  const w = worker();
  await w.dispatch("notificationclick", {notification:{close:vi.fn(),data:{path:`/${kind}/${id}`}}});
  expect(w.openWindow).toHaveBeenCalledWith(`https://nexosubastas.com/${kind}/${id}`);
});
it("opens a new window when existing window navigation fails", async () => {
  const navigate = vi.fn().mockRejectedValue(new Error("Unavailable"));
  const w = worker([{url:"https://nexosubastas.com/perfil", navigate}]);
  await w.dispatch("notificationclick", {notification:{close:vi.fn(),data:{path:`/operaciones/${id}`}}});
  expect(navigate).toHaveBeenCalledWith(`https://nexosubastas.com/operaciones/${id}`);
  expect(w.openWindow).toHaveBeenCalledWith(`https://nexosubastas.com/operaciones/${id}`);
});
it("claims windows during messaging worker activation", async () => {
  const w = worker();
  await w.dispatch("activate", {});
  expect(w.claim).toHaveBeenCalledOnce();
});