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
import { registerPush } from "@/lib/push";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { errMsg } from "@/lib/format";
export function PushPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["push-settings", user?.id],
    queryFn: () => getPushSettings(),
    enabled: !!user,
  });
  const save = useServerFn(savePushPreferences);
  const fetchSettings = useServerFn(getPushSettings);
  const register = useServerFn(registerPushDevice);
  const disable = useServerFn(disablePushDevices);
  const [enabled, setEnabled] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.data) {
      setEnabled(query.data.preferences.new_auctions);
      setCategories(query.data.preferences.categories);
    }
  }, [query.data]);
  async function perform(action: () => Promise<unknown>) {
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
              onClick={() => perform(() => save({ data: { enabled, categories } }))}
            >
              Guardar avisos
            </Button>
            <Button
              disabled={busy || !enabled || !query.data.configured}
              onClick={() =>
                perform(async () => {
                  if (!query.data) return;
                  const token = await registerPush(query.data.config);
                  await register({ data: { token } });
                  await save({ data: { enabled, categories } });
                })
              }
            >
              Permitir push en este dispositivo
            </Button>
            {query.data.devices > 0 && (
              <Button variant="ghost" disabled={busy} onClick={() => perform(() => disable())}>
                Desactivar push en mis dispositivos
              </Button>
            )}
          </div>
          {!query.data.configured && (
            <p className="text-sm text-muted-foreground">
              Push fuera de NEXO pendiente de configuración. Los avisos internos sí pueden
              habilitarse.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            La entrega depende del permiso del navegador, compatibilidad del dispositivo y
            restricciones del sistema. La miniatura se muestra solo donde sea compatible.
          </p>
        </>
      )}
    </section>
  );
}
