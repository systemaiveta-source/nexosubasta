import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPushSettings, savePushPreferences } from "@/lib/push.functions";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toggleCategoryGroup, toggleCategorySelection } from "@/lib/category-filter";
import { toast } from "sonner";
import { useMemo, useState } from "react";

type Category = { id: string; name: string; parent_id: string | null; sort: number };

export function PushPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetch = useServerFn(getPushSettings);
  const save = useServerFn(savePushPreferences);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ enabled: boolean; activity: boolean; categories: string[] } | null>(null);
  const query = useQuery({
    queryKey: ["push-settings", user?.id],
    queryFn: () => fetch(),
    enabled: !!user,
  });
  const categoryQuery = useQuery({
    queryKey: ["push-category-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories")
        .select("id,name,parent_id,sort,active")
        .eq("active", true).order("sort").order("name");
      if (error) throw error;
      const rows = data as Category[];
      const roots = rows.filter((item) => !item.parent_id);
      const rootIds = new Set(roots.map((item) => item.id));
      return rows.filter((item) => !item.parent_id || rootIds.has(item.parent_id));
    },
    enabled: !!user,
  });
  const roots = useMemo(
    () => (categoryQuery.data ?? []).filter((item) => !item.parent_id),
    [categoryQuery.data],
  );
  const children = useMemo(
    () => (categoryQuery.data ?? []).filter((item) => item.parent_id),
    [categoryQuery.data],
  );
  async function change(
    enabled: boolean,
    activity: boolean,
    categories: string[],
  ) {
    setPending({ enabled, activity, categories });
    setBusy(true);
    try {
      await save({ data: { enabled, activity, categories } });
      await qc.invalidateQueries({ queryKey: ["push-settings", user?.id] });
      toast.success("Preferencias de avisos guardadas");
    } catch {
      toast.error("No se pudieron guardar tus preferencias");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }
  function toggleCategory(id: string, checked: boolean) {
    if (!query.data || !categoryQuery.data || busy) return;
    const allIds = categoryQuery.data.map((item) => item.id);
    const normalized = toggleCategorySelection(
      pending?.categories ?? query.data.preferences.categories,
      id,
      checked,
      allIds,
    );
    void change(
      pending?.enabled ?? query.data.preferences.new_auctions,
      pending?.activity ?? query.data.preferences.activity,
      normalized,
    );
  }
  const selectedCategories = pending?.categories ?? query.data?.preferences.categories ?? [];
  const allCategories = !selectedCategories.length;
  const categoryIds = new Set(selectedCategories);
  return (
    <section className="mb-6 space-y-3 border-y border-border py-4">
      <h2 className="font-semibold">Preferencias de avisos</h2>
      {query.isError ? (
        <p role="alert">No se pudieron cargar las preferencias.</p>
      ) : !query.data ? (
        <p role="status">Cargando preferencias…</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={busy}
              checked={pending?.enabled ?? query.data.preferences.new_auctions}
              onChange={(e) => change(e.target.checked, query.data.preferences.activity, query.data.preferences.categories)}
            />
            Avisarme cuando se publiquen nuevas subastas
          </label>
          <div className="rounded-lg bg-secondary/40 p-3">
            <p className="text-sm font-medium">Categorías que quiero recibir</p>
            <p className="mt-1 text-xs text-muted-foreground">Puedes elegir una o varias. Si no seleccionas ninguna, recibirás avisos de todas las categorías.</p>
            {categoryQuery.isError ? <p role="alert" className="mt-2 text-sm">No se pudieron cargar las categorías.</p> : !categoryQuery.data ? <p role="status" className="mt-2 text-sm">Cargando categorías…</p> : (
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" disabled={busy} checked={allCategories} onChange={() => change(
                    pending?.enabled ?? query.data!.preferences.new_auctions,
                    pending?.activity ?? query.data!.preferences.activity,
                    [],
                  )} />
                  Todas las categorías
                </label>
                {roots.map((root) => {
                  const childIds = children.filter((child) => child.parent_id === root.id).map((child) => child.id);
                  const ids = [root.id, ...childIds];
                  const checked = allCategories || ids.some((id) => categoryIds.has(id));
                  return (
                    <div key={root.id} className="border-l-2 border-border pl-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" disabled={busy} checked={allCategories || categoryIds.has(root.id) || childIds.length > 0 && childIds.every((id) => categoryIds.has(id))}
                          onChange={(e) => {
                            const next = toggleCategoryGroup(
                              selectedCategories,
                              ids,
                              e.target.checked,
                              categoryQuery.data!.map((item) => item.id),
                            );
                            void change(
                              pending?.enabled ?? query.data!.preferences.new_auctions,
                              pending?.activity ?? query.data!.preferences.activity,
                              next,
                            );
                          }} />
                        {root.name}
                      </label>
                      {childIds.length > 0 && (
                        <div className="mt-2 grid gap-2 pl-5 sm:grid-cols-2">
                          {children.filter((child) => child.parent_id === root.id).map((child) => (
                            <label key={child.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" disabled={busy} checked={allCategories || categoryIds.has(child.id)} onChange={(e) => toggleCategory(child.id, e.target.checked)} />
                              {child.name}
                            </label>
                          ))}
                        </div>
                      )}
                      {!checked && <span className="sr-only">Sin selección</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={busy}
              checked={pending?.activity ?? query.data.preferences.activity}
              onChange={(e) => change(query.data.preferences.new_auctions, e.target.checked, query.data.preferences.categories)}
            />
            Mis pujas, cierres, chat y operaciones
          </label>
          {!query.data.configured && (
            <p role="status" className="text-sm text-muted-foreground">
              El permiso y las preferencias se pueden guardar, pero los avisos externos están pendientes de configuración segura.
            </p>
          )}
          {query.data.configured && !query.data.deliveryEnabled && (
            <p role="status" className="text-sm text-muted-foreground">
              El envío externo aún no está activado.
            </p>
          )}
        </>
      )}
    </section>
  );
}
