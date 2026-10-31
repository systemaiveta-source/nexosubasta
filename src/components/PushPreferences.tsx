import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  getPushSettings,
  savePushPreferences,
  registerPushDevice,
  disablePushDevices,
} from "@/lib/push.functions";
import {
  registerPush,
  currentPushSubscription,
  unsubscribePush,
  devicePushState,
  type DevicePushState,
} from "@/lib/push";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { errMsg } from "@/lib/format";
export function PushPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getPushSettings);
  const query = useQuery({
    queryKey: ["push-settings", user?.id],
    queryFn: () => fetchSettings(),
    enabled: !!user,
  });
  const save = useServerFn(savePushPreferences);
  const register = useServerFn(registerPushDevice);
  const disable = useServerFn(disablePushDevices);
  const [enabled, setEnabled] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [deviceState, setDeviceState] = useState<DevicePushState>("inactive");
  const [activity, setActivity] = useState(true);
  useEffect(() => {
    if (query.data) {
      setEnabled(query.data.preferences.new_auctions);
      setCategories(query.data.preferences.categories);
      setActivity(query.data.preferences.activity);
    }
  }, [query.data]);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const supported =
          window.isSecureContext &&
          "Notification" in window &&
          "PushManager" in window &&
          "serviceWorker" in navigator;
        const subscription = supported ? await currentPushSubscription() : null;
        if (!cancelled)
          setDeviceState(
            devicePushState(
              supported,
              supported ? Notification.permission : "default",
              subscription?.endpoint ?? null,
              query.data?.endpoints ?? [],
            ),
          );
      } catch {
        if (!cancelled) setDeviceState("failed");
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, [query.data]);
  async function perform(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await qc.invalidateQueries({ queryKey: ["push-settings"] });
      toast.success("Preferencias actualizadas");
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-6 space-y-3 border-y border-border py-4">
      <h2 className="font-semibold">Avisos de nuevas subastas</h2>
      {query.isError ? (
        <p role="alert">No se pudieron cargar las preferencias.</p>
      ) : !query.data ? (
        <p role="status">Cargando preferencias…</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Recibir avisos de nuevas subastas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activity}
              onChange={(event) => setActivity(event.target.checked)}
            />
            Avisos de mis pujas, cierres y operaciones
          </label>
          <details>
            <summary className="cursor-pointer text-sm">
              Categorías: {categories.length ? `${categories.length} seleccionadas` : "todas"}
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {query.data.categories.map((category) => (
                <label key={category.id} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={categories.includes(category.id)}
                    onChange={(event) =>
                      setCategories(
                        event.target.checked
                          ? [...categories, category.id]
                          : categories.filter((id) => id !== category.id),
                      )
                    }
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => perform(() => save({ data: { enabled, categories, activity } }))}
            >
              Guardar avisos
            </Button>
            {deviceState !== "active" && (
              <Button
                disabled={
                  busy ||
                  (!enabled && !activity) ||
                  !query.data.configured ||
                  deviceState === "blocked" ||
                  deviceState === "unsupported"
                }
                onClick={() =>
                  perform(async () => {
                    if (!query.data) return;
                    setPushError(null);
                    try {
                      const subscription = await registerPush(query.data.config);
                      await register({ data: { subscription } });
                      await save({ data: { enabled, categories, activity } });
                    } catch (error) {
                      setPushError(errMsg(error));
                      throw error;
                    }
                  })
                }
              >
                Activar avisos en este dispositivo
              </Button>
            )}
            {deviceState === "active" && (
              <>
                <p role="status" className="self-center text-sm text-nexo-green">
                  Avisos activos en este dispositivo
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      const subscription = await currentPushSubscription();
                      if (!subscription) return;
                      await disable({ data: { endpoint: subscription.endpoint } });
                      await unsubscribePush();
                    })
                  }
                >
                  Desactivar este dispositivo
                </Button>
              </>
            )}
            {query.data.devices > 0 && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    await disable({ data: {} });
                    await unsubscribePush();
                  })
                }
              >
                Desactivar push en mis dispositivos
              </Button>
            )}
          </div>
          {deviceState === "blocked" && (
            <p role="status" className="text-sm text-muted-foreground">
              Permiso bloqueado en los ajustes del navegador.
            </p>
          )}
          {deviceState === "unsupported" && (
            <p role="status" className="text-sm text-muted-foreground">
              Este navegador no admite avisos en segundo plano.
            </p>
          )}
          {deviceState === "unregistered" && (
            <p role="status" className="text-sm text-muted-foreground">
              Permiso concedido; falta vincular este dispositivo a tu cuenta.
            </p>
          )}
          {deviceState === "failed" && (
            <p role="alert">No se pudo comprobar la suscripción de este dispositivo.</p>
          )}
          {pushError && (
            <p role="alert" className="text-sm text-destructive">
              {pushError}
            </p>
          )}
          {query.data.configured && !query.data.deliveryEnabled && (
            <p role="status" className="text-sm text-muted-foreground">
              Puedes autorizar este dispositivo, pero el envío externo aún no está activado.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Con los envíos activados, los avisos pueden llegar aunque NEXO esté cerrado. Dependen
            del permiso, conexión y restricciones del dispositivo. En iPhone o iPad, abre NEXO desde
            su icono instalado. No se garantiza recepción si el navegador o sistema bloquea la
            actividad en segundo plano.
          </p>
        </>
      )}
    </section>
  );
}
