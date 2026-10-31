import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SOCIAL_NETWORKS, socialLinkSchema } from "@/lib/social-links";
import {
  listAdminSocialLinks,
  saveSocialLink,
  deleteSocialLink,
} from "@/lib/social-links.functions";
import { errMsg } from "@/lib/format";
import type { z } from "zod";
type Form = z.infer<typeof socialLinkSchema>;
const empty: Form = { network: "Facebook", label: "Facebook", url: "", active: false, sort: 0 };
export function SocialLinksAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminSocialLinks);
  const save = useServerFn(saveSocialLink);
  const remove = useServerFn(deleteSocialLink);
  const query = useQuery({ queryKey: ["admin-social-links"], queryFn: () => list() });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      setForm(null);
      await qc.invalidateQueries({ queryKey: ["admin-social-links"] });
      await qc.invalidateQueries({ queryKey: ["public-social-links"] });
      toast.success("Redes actualizadas");
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Redes sociales de NEXO</h2>
        <Button
          variant="outline"
          onClick={() => setForm({ ...empty, sort: query.data?.length ?? 0 })}
        >
          <Plus className="h-4 w-4" />
          Agregar red
        </Button>
      </div>
      {query.isError && <p role="alert">No se pudieron cargar las redes.</p>}
      {query.isPending && <p role="status">Cargando…</p>}
      {query.data?.length === 0 && <p className="text-muted-foreground">Sin redes configuradas.</p>}
      {form && (
        <form
          className="space-y-3 border-y border-border py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(() => save({ data: socialLinkSchema.parse(form) }));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              Red
              <select
                aria-label="Red social"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
                value={form.network}
                onChange={(event) =>
                  setForm({
                    ...form,
                    network: event.target.value as Form["network"],
                    label: event.target.value,
                  })
                }
              >
                {SOCIAL_NETWORKS.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Nombre
              <Input
                required
                maxLength={60}
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Enlace HTTPS
              <Input
                required
                type="url"
                maxLength={2048}
                value={form.url}
                onChange={(event) => setForm({ ...form, url: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Orden
              <Input
                type="number"
                min={0}
                max={10000}
                value={form.sort}
                onChange={(event) => setForm({ ...form, sort: Number(event.target.value) })}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.active}
              onCheckedChange={(active) => setForm({ ...form, active })}
            />
            Visible en NEXO
          </label>
          <div className="flex gap-2">
            <Button disabled={busy} type="submit">
              <Save className="h-4 w-4" />
              Guardar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </form>
      )}
      <ul className="divide-y divide-border">
        {query.data?.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="text-sm text-muted-foreground">{row.sort}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.label}</p>
              <p className="break-all text-xs text-muted-foreground">{row.url}</p>
            </div>
            <Switch
              aria-label={`Visibilidad ${row.label}`}
              disabled={busy}
              checked={row.active}
              onCheckedChange={(active) => void perform(() => save({ data: { ...row, active } }))}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${row.label}`}
              title="Editar"
              onClick={() => setForm(socialLinkSchema.parse(row))}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={`Eliminar ${row.label}`}
              title="Eliminar"
              onClick={() => {
                if (window.confirm(`¿Eliminar ${row.label} de NEXO?`))
                  void perform(() => remove({ data: { id: row.id } }));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
