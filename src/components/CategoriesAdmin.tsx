import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Category = {
  id: string;
  slug: string;
  name: string;
  sort: number;
  parent_id: string | null;
  description: string | null;
  icon: string | null;
  active: boolean;
  updated_at: string;
};

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const slugify = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

export function CategoriesAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [sort, setSort] = useState("50");
  const query = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories")
        .select("id,slug,name,sort,parent_id,description,icon,active,updated_at")
        .order("sort").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      const cleanSlug = slugify(slug || cleanName);
      const order = Number(sort);
      if (!cleanName || !cleanSlug || !Number.isInteger(order) || order < 0 || order > 10000)
        throw new Error("Completa un nombre, slug y orden válidos");
      if (parentId && parentId === editing) throw new Error("Una categoría no puede ser su propia subcategoría");
      const payload = {
        name: cleanName,
        slug: cleanSlug,
        sort: order,
        parent_id: parentId || null,
        description: description.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const result = editing
        ? await supabase.from("categories").update(payload).eq("id", editing)
        : await supabase.from("categories").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      toast.success("Categoría guardada");
      reset();
      await qc.invalidateQueries({ queryKey: ["admin-categories"] });
      await qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo guardar"),
  });
  const toggle = useMutation({
    mutationFn: async (item: Category) => {
      if (item.parent_id === null && item.active) {
        const children = (query.data ?? []).filter((row) => row.parent_id === item.id && row.active);
        if (children.length) throw new Error("Desactiva primero las subcategorías activas");
      }
      const { error } = await supabase.from("categories")
        .update({ active: !item.active, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Estado de categoría actualizado");
      await qc.invalidateQueries({ queryKey: ["admin-categories"] });
      await qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado"),
  });
  function reset() {
    setEditing(null); setName(""); setSlug(""); setParentId(""); setDescription(""); setSort("50");
  }
  function edit(item: Category) {
    setEditing(item.id); setName(item.name); setSlug(item.slug);
    setParentId(item.parent_id ?? ""); setDescription(item.description ?? "");
    setSort(String(item.sort));
  }
  const roots = useMemo(() => (query.data ?? []).filter((item) => !item.parent_id), [query.data]);
  const children = useMemo(() => (query.data ?? []).filter((item) => item.parent_id), [query.data]);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">{editing ? "Editar categoría" : "Crear categoría o subcategoría"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra la clasificación sin cambiar el código. Las categorías utilizadas en subastas se desactivan; no se eliminan.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Nombre
            <input className={field} maxLength={80} value={name} onChange={(e) => {
              setName(e.target.value); if (!editing) setSlug(slugify(e.target.value));
            }} />
          </label>
          <label className="text-sm">Slug
            <input className={field} maxLength={70} value={slug} disabled={!!editing} onChange={(e) => setSlug(slugify(e.target.value))} />
          </label>
          <label className="text-sm">Categoría principal
            <select className={field} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Sin principal · categoría general</option>
              {roots.filter((item) => item.id !== editing && item.active).map((item) =>
                <option key={item.id} value={item.id}>{item.name}</option>
              )}
            </select>
          </label>
          <label className="text-sm">Orden
            <input className={field} type="number" min="0" max="10000" value={sort} onChange={(e) => setSort(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-2">Descripción (opcional)
            <textarea className={field} rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
          </button>
          {editing && <button className="rounded-md border border-border px-4 py-2 text-sm" onClick={reset}>Cancelar edición</button>}
        </div>
      </div>
      {query.isError ? <p role="alert">No se pudieron cargar las categorías.</p> : !query.data ? <p role="status">Cargando categorías…</p> : (
        <div className="space-y-4">
          {roots.map((root) => (
            <section key={root.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-semibold">{root.name}</h3><p className="text-xs text-muted-foreground">{root.slug} · Orden {root.sort} · {root.active ? "Activa" : "Inactiva"}</p></div>
                <div className="flex gap-2">
                  <button className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => edit(root)}>Editar</button>
                  <button className="rounded-md border border-border px-3 py-1.5 text-sm" disabled={toggle.isPending} onClick={() => toggle.mutate(root)}>{root.active ? "Desactivar" : "Activar"}</button>
                </div>
              </div>
              {root.description && <p className="mt-2 text-sm text-muted-foreground">{root.description}</p>}
              <div className="mt-3 space-y-2 border-l-2 border-border pl-4">
                {children.filter((child) => child.parent_id === root.id).map((child) => (
                  <div key={child.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div><span className="font-medium">{child.name}</span><span className="ml-2 text-xs text-muted-foreground">{child.slug} · {child.active ? "Activa" : "Inactiva"}</span></div>
                    <div className="flex gap-2">
                      <button className="rounded-md border border-border px-2 py-1" onClick={() => edit(child)}>Editar</button>
                      <button className="rounded-md border border-border px-2 py-1" disabled={toggle.isPending} onClick={() => toggle.mutate(child)}>{child.active ? "Desactivar" : "Activar"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
