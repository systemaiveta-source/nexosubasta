import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getPushSettings, registerPushDevice, disablePushDevices } from "@/lib/push.functions";
import { currentPushSubscription, registerPush, unsubscribePush } from "@/lib/push";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** One mounted lifecycle: passive synchronization never invokes a permission prompt. */
export function PushLifecycle() {
  const { user } = useAuth();
  const path = useRouterState({ select: s => s.location.pathname });
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getPushSettings);
  const register = useServerFn(registerPushDevice);
  const disable = useServerFn(disablePushDevices);
  const query = useQuery({ queryKey: ["push-settings", user?.id], queryFn: () => fetchSettings(), enabled: !!user });
  const [offer, setOffer] = useState(false);
  const [busy, setBusy] = useState(false);
  const syncing = useRef(false);
  const previousUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousUser.current && previousUser.current !== user?.id) void unsubscribePush().catch(() => {});
    previousUser.current = user?.id;
    setOffer(false);
  }, [user?.id]);
  useEffect(() => {
    if (!user || !query.data?.configured || !("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator) || window.top !== window.self) return;
    const account = user.id;
    const endpointKey = `nexo-push-endpoint:${account}`;
    const promptKey = "nexo-push-context-seen";
    if (path === "/notificaciones" && Notification.permission === "default" && !localStorage.getItem(promptKey)) {
      localStorage.setItem(promptKey, "1");
      setOffer(true);
    }
    let cancelled = false;
    async function sync() {
      if (syncing.current || cancelled) return;
      syncing.current = true;
      try {
        const subscription = await currentPushSubscription();
        const endpoint = subscription?.endpoint ?? localStorage.getItem(endpointKey);
        if (Notification.permission !== "granted") {
          if (endpoint) await disable({ data: { endpoint } });
          await unsubscribePush();
          localStorage.removeItem(endpointKey);
          if (Notification.permission === "denied") setOffer(false);
        } else if (query.data && !cancelled) {
          const json = await registerPush(query.data.config);
          if (cancelled) return;
          await register({ data: { subscription: json } });
          if (json.endpoint) localStorage.setItem(endpointKey, json.endpoint);
        }
      } catch { /* Retry on next focus/online event without requesting permission. */ }
      finally { syncing.current = false; }
    }
    void sync();
    const visibility = () => { if (document.visibilityState === "visible") void sync(); };
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", visibility);
    let permissionStatus: PermissionStatus | undefined;
    void navigator.permissions?.query({ name: "notifications" }).then(status => {
      if (cancelled) return;
      permissionStatus = status;
      status.addEventListener("change", sync);
    }).catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", visibility);
      permissionStatus?.removeEventListener("change", sync);
    };
  }, [user?.id, query.data, path, disable, register]);
  async function allow() {
    if (!query.data || !user || busy) return;
    setBusy(true);
    // registerPush reaches the native prompt synchronously from this user gesture.
    try {
      const subscription = await registerPush(query.data.config);
      await register({ data: { subscription } });
      if (subscription.endpoint) localStorage.setItem(`nexo-push-endpoint:${user.id}`, subscription.endpoint);
      await qc.invalidateQueries({ queryKey: ["push-settings", user.id] });
      toast.success("Permiso concedido y dispositivo vinculado");
    } catch { toast.info("Puedes revisar el permiso en los ajustes del navegador o del dispositivo."); }
    finally { setBusy(false); setOffer(false); }
  }
  if (!offer || !user) return null;
  return <aside aria-label="Permiso de notificaciones" className="border-b border-border bg-secondary px-4 py-3">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
      <p className="flex-1 text-sm">¿Recibir avisos de nuevas subastas, ofertas y mensajes cuando NEXO esté cerrado?</p>
      <Button disabled={busy} onClick={allow}>Permitir ahora</Button>
      <Button variant="ghost" disabled={busy} onClick={() => setOffer(false)}>Ahora no</Button>
    </div>
  </aside>;
}