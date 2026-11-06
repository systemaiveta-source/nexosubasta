import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPushSettings, savePushPreferences } from "@/lib/push.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";

export function PushPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetch = useServerFn(getPushSettings);
  const save = useServerFn(savePushPreferences);
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["push-settings", user?.id], queryFn: () => fetch(), enabled: !!user });
  async function change(enabled: boolean, activity: boolean) {
    setBusy(true);
    try {
      await save({ data: { enabled, activity } });
      await qc.invalidateQueries({ queryKey: ["push-settings", user?.id] });
    } catch { toast.error("No se pudieron guardar tus preferencias"); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 space-y-3 border-y border-border py-4">
    <h2 className="font-semibold">Preferencias de avisos</h2>
    {query.isError ? <p role="alert">No se pudieron cargar las preferencias.</p> : !query.data ? <p role="status">Cargando preferencias…</p> : <>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={query.data.preferences.new_auctions} onChange={e => change(e.target.checked, query.data?.preferences.activity ?? true)} />Nuevas subastas · todas las categorías</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={query.data.preferences.activity} onChange={e => change(query.data?.preferences.new_auctions ?? true, e.target.checked)} />Mis pujas, cierres, chat y operaciones</label>
      {!query.data.configured && <p role="status" className="text-sm text-muted-foreground">Los avisos externos están pendientes de configuración.</p>}
      {query.data.configured && !query.data.deliveryEnabled && <p role="status" className="text-sm text-muted-foreground">El envío externo aún no está activado.</p>}
    </>}
  </section>;
}
