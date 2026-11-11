import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageShell, Empty } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { PaymentMethodsAdmin } from "@/components/PaymentMethodsAdmin";
import { MembershipRequests } from "@/components/MembershipRequests";
import { SocialLinksAdmin } from "@/components/SocialLinksAdmin";
import { modeLabel } from "@/lib/auction-timing";
import { MembershipSupport } from "@/components/MembershipSupport";
import { CategoriesAdmin } from "@/components/CategoriesAdmin";

export const Route = createFileRoute("/_authenticated/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Administración — NEXO" },
      { name: "description", content: "Panel de administración de NEXO." },
      { property: "og:title", content: "Administración — NEXO" },
      { property: "og:description", content: "Panel de administración de NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  ["resumen", "Resumen"],
  ["pagos", "Pagos por aprobar"],
  ["planes", "Membresías"],
  ["metodos", "Métodos de pago"],
  ["categorias", "Categorías"],
  ["redes", "Redes sociales"],
  ["usuarios", "Usuarios"],
  ["subastas", "Subastas"],
  ["disputas", "Disputas"],
  ["ajustes", "Ajustes"],
  ["registro", "Registro"],
  ["soporte", "Soporte"],
] as const;
type Tab = (typeof TABS)[number][0];

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const btn =
  "rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
const btn2 =
  "rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50";
const card = "rounded-xl border border-border bg-card p-4";
const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : ((e as { message?: string })?.message ?? "Error");
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es") : "—");

function AdminPage() {
  const { isStaff, isAdmin, loading } = useRoles();
  const [tab, setTab] = useState<Tab>("resumen");
  if (loading)
    return (
      <PageShell title="Administración">
        <Empty>Cargando…</Empty>
      </PageShell>
    );
  if (!isStaff)
    return (
      <PageShell title="Administración">
        <Empty>No tienes acceso a esta sección.</Empty>
      </PageShell>
    );
  return (
    <PageShell title="Administración">
      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {!isAdmin && tab !== "resumen" && tab !== "subastas" ? (
        <Empty>Solo los administradores pueden usar esta sección.</Empty>
      ) : (
        <>
          {tab === "resumen" && <Resumen go={setTab} />}
          {tab === "pagos" && <MembershipRequests admin />}
          {tab === "planes" && <Planes />}
          {tab === "metodos" && <PaymentMethodsAdmin />}
          {tab === "categorias" && <CategoriesAdmin />}
          {tab === "redes" && <SocialLinksAdmin />}
          {tab === "usuarios" && <Usuarios />}
          {tab === "subastas" && <Subastas />}
          {tab === "disputas" && <Disputas />}
          {tab === "ajustes" && <Ajustes />}
          {tab === "registro" && <Registro />}
          {tab === "soporte" && <MembershipSupport admin />}
        </>
      )}
    </PageShell>
  );
}

function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`${card} text-left hover:bg-secondary/50`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </button>
  );
}

function Resumen({ go }: { go: (t: Tab) => void }) {
  const q = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const c = async (
        t: "profiles" | "auctions" | "subscription_requests" | "subscriptions" | "disputes",
        f?: [string, string],
      ) => {
        let qq = supabase.from(t).select("id", { count: "exact", head: true });
        if (f) qq = qq.eq(f[0], f[1]);
        const { count } = await qq;
        return count ?? 0;
      };
      const [users, active, pending, subs, disputes] = await Promise.all([
        c("profiles"),
        c("auctions", ["status", "active"]),
        c("subscription_requests", ["status", "pending"]),
        c("subscriptions", ["status", "active"]),
        c("disputes", ["status", "open"]),
      ]);
      return { users, active, pending, subs, disputes };
    },
  });
  const d = q.data;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Stat label="Usuarios" value={d?.users ?? "…"} onClick={() => go("usuarios")} />
      <Stat label="Subastas activas" value={d?.active ?? "…"} onClick={() => go("subastas")} />
      <Stat label="Pagos por aprobar" value={d?.pending ?? "…"} onClick={() => go("pagos")} />
      <Stat label="Membresías activas" value={d?.subs ?? "…"} onClick={() => go("usuarios")} />
      <Stat label="Disputas abiertas" value={d?.disputes ?? "…"} onClick={() => go("disputas")} />
    </div>
  );
}


type AdminDispute = {
  id: string;
  transaction_id: string;
  reason: string;
  status: "open" | "resolved" | "rejected";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
};

function Disputas() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async (): Promise<AdminDispute[]> => {
      const { data, error } = await supabase
        .from("disputes")
        .select("id,transaction_id,reason,status,resolution,created_at,resolved_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AdminDispute[];
    },
  });
  const resolve = useMutation({
    mutationFn: async (args: {
      id: string;
      status: "resolved" | "rejected";
      resolution: string;
      txStatus: "pending" | "completed" | "cancelled";
    }) => {
      const { error } = await supabase.rpc("resolve_dispute", {
        _dispute: args.id,
        _status: args.status,
        _resolution: args.resolution,
        _tx_status: args.txStatus,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Disputa actualizada y participantes notificados");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-disputes"] }),
        qc.invalidateQueries({ queryKey: ["admin-stats"] }),
      ]);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <Empty>Cargando disputas…</Empty>;
  if (q.error) return <Empty>No se pudieron cargar las disputas. {errMsg(q.error)}</Empty>;
  if (!q.data?.length) return <Empty>No hay disputas registradas.</Empty>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Casos visibles para administración. Abre la operación para revisar el chat y sus antecedentes antes de decidir.
      </p>
      {q.data.map((d) => (
        <DisputaCard
          key={d.id}
          dispute={d}
          busy={resolve.isPending}
          onResolve={(status, resolution, txStatus) =>
            resolve.mutate({ id: d.id, status, resolution, txStatus })
          }
        />
      ))}
    </div>
  );
}

function DisputaCard({
  dispute,
  busy,
  onResolve,
}: {
  dispute: AdminDispute;
  busy: boolean;
  onResolve: (
    status: "resolved" | "rejected",
    resolution: string,
    txStatus: "pending" | "completed" | "cancelled",
  ) => void;
}) {
  const [resolution, setResolution] = useState("");
  const [txStatus, setTxStatus] = useState<"pending" | "completed" | "cancelled">("pending");
  const isOpen = dispute.status === "open";
  return (
    <article className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Disputa · {dispute.status === "open" ? "Abierta" : dispute.status === "resolved" ? "Resuelta" : "Rechazada"}</p>
          <p className="text-xs text-muted-foreground">Caso {dispute.id.slice(0, 8)} · {fmtDate(dispute.created_at)}</p>
        </div>
        <Link to="/operaciones/$id" params={{ id: dispute.transaction_id }} className="text-sm font-semibold underline">
          Revisar operación y chat
        </Link>
      </div>
      <div className="rounded-lg bg-secondary/50 p-3 text-sm whitespace-pre-wrap break-words">{dispute.reason}</div>
      {!isOpen ? (
        <div className="text-sm">
          <p className="font-medium">Resolución registrada</p>
          <p className="whitespace-pre-wrap">{dispute.resolution || "Sin detalle adicional."}</p>
        </div>
      ) : (
        <div className="space-y-3 border-t border-border pt-3">
          <label className="block space-y-1 text-sm">
            Resolución / explicación para ambas partes
            <textarea
              className={input}
              rows={3}
              maxLength={2000}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describe la decisión y los motivos (mínimo 5 caracteres)."
            />
          </label>
          <label className="block space-y-1 text-sm">
            Estado final de la operación
            <select className={input} value={txStatus} onChange={(e) => setTxStatus(e.target.value as typeof txStatus)}>
              <option value="pending">Reanudar operación</option>
              <option value="completed">Marcar como completada</option>
              <option value="cancelled">Cancelar operación</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy || resolution.trim().length < 5} onClick={() => onResolve("resolved", resolution.trim(), txStatus)}>
              Resolver disputa
            </button>
            <button className={btn2} disabled={busy || resolution.trim().length < 5} onClick={() => onResolve("rejected", resolution.trim(), txStatus)}>
              Rechazar disputa
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Planes() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("months");
      if (error) throw error;
      return data;
    },
  });
  if (!q.data) return <Empty>Cargando…</Empty>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {q.data.map((p) => (
        <PlanForm
          key={p.id}
          p={p}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-plans"] })}
        />
      ))}
    </div>
  );
}

type PlanRow = {
  id: string;
  name: string;
  price: number | null;
  referral_pct: number;
  max_active_auctions: number | null;
  benefits: string[];
  active: boolean;
  months: number;
};
function PlanForm({ p, onSaved }: { p: PlanRow; onSaved: () => void }) {
  const [f, setF] = useState({
    name: p.name,
    price: String(p.price ?? ""),
    pct: String(p.referral_pct),
    max: String(p.max_active_auctions ?? ""),
    benefits: p.benefits.join("\n"),
    active: p.active,
  });
  const m = useMutation({
    mutationFn: async () => {
      const price = Number(f.price),
        pct = Number(f.pct);
      if (!(price >= 0) || !(pct >= 0 && pct <= 100))
        throw new Error("Precio o porcentaje no válido");
      const { error } = await supabase
        .from("plans")
        .update({
          name: f.name.trim(),
          price,
          referral_pct: pct,
          max_active_auctions: f.max ? Number(f.max) : null,
          benefits: f.benefits
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          active: f.active,
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membresía guardada");
      onSaved();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className={`${card} space-y-2`}>
      <p className="text-xs text-muted-foreground">
        {p.months} {p.months === 1 ? "mes" : "meses"}
      </p>
      <label className="block text-sm">
        Nombre
        <input
          className={input}
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm">
          Precio (USD)
          <input
            className={input}
            inputMode="decimal"
            value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })}
          />
        </label>
        <label className="text-sm">
          % referidos
          <input
            className={input}
            inputMode="decimal"
            value={f.pct}
            onChange={(e) => setF({ ...f, pct: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Subastas máx.
          <input
            className={input}
            inputMode="numeric"
            value={f.max}
            placeholder="Sin límite"
            onChange={(e) => setF({ ...f, max: e.target.value })}
          />
        </label>
      </div>
      <label className="block text-sm">
        Beneficios (uno por línea)
        <textarea
          rows={4}
          className={input}
          value={f.benefits}
          onChange={(e) => setF({ ...f, benefits: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={f.active}
          onChange={(e) => setF({ ...f, active: e.target.checked })}
        />{" "}
        Visible para los usuarios
      </label>
      <button className={btn} disabled={m.isPending} onClick={() => m.mutate()}>
        Guardar
      </button>
    </div>
  );
}

function Usuarios() {
  const qc = useQueryClient();
  const [s, setS] = useState("");
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data;
    },
  });
  const plans = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("months")).data ?? [],
  });
  const done = () => {
    toast.success("Hecho");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const role = useMutation({
    mutationFn: async (a: { u: string; r: "admin" | "moderator" | "seller"; g: boolean }) => {
      const { error } = await supabase.rpc("admin_set_role", {
        _user: a.u,
        _role: a.r,
        _grant: a.g,
      });
      if (error) throw error;
    },
    onSuccess: done,
    onError: (e) => toast.error(errMsg(e)),
  });
  const status = useMutation({
    mutationFn: async (a: { u: string; st: string }) => {
      const { error } = await supabase.rpc("admin_set_status", { _user: a.u, _status: a.st });
      if (error) throw error;
    },
    onSuccess: done,
    onError: (e) => toast.error(errMsg(e)),
  });
  const grant = useMutation({
    mutationFn: async (a: { u: string; p: string; m: number }) => {
      const { error } = await supabase.rpc("admin_grant_subscription", {
        _user: a.u,
        _plan: a.p,
        _months: a.m,
      });
      if (error) throw error;
    },
    onSuccess: done,
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = (q.data ?? []).filter(
    (u) => !s || `${u.display_name} ${u.email}`.toLowerCase().includes(s.toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <input
        className={input}
        placeholder="Buscar por nombre o correo"
        value={s}
        onChange={(e) => setS(e.target.value)}
      />
      {!list.length && <Empty>{q.isLoading ? "Cargando…" : "Sin resultados."}</Empty>}
      {list.map((u) => {
        const has = (r: string) => u.roles.includes(r);
        return (
          <div key={u.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to="/usuarios/$id"
                  params={{ id: u.id }}
                  className="font-semibold hover:underline"
                >
                  {u.display_name}
                </Link>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  Roles: {u.roles.join(", ")} · Membresía hasta:{" "}
                  {u.seller_sub_until
                    ? new Date(u.seller_sub_until).toLocaleDateString("es")
                    : "ninguna"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs ${u.account_status === "active" ? "bg-secondary" : "bg-destructive text-destructive-foreground"}`}
              >
                {u.account_status === "active" ? "Activa" : "Suspendida"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["seller", "moderator", "admin"] as const).map((r) => (
                <button
                  key={r}
                  className={btn2}
                  disabled={role.isPending}
                  onClick={() => role.mutate({ u: u.id, r, g: !has(r) })}
                >
                  {has(r) ? "Quitar" : "Dar"}{" "}
                  {r === "seller" ? "vendedor" : r === "moderator" ? "moderador" : "admin"}
                </button>
              ))}
              <button
                className={btn2}
                disabled={status.isPending}
                onClick={() =>
                  status.mutate({
                    u: u.id,
                    st: u.account_status === "active" ? "suspended" : "active",
                  })
                }
              >
                {u.account_status === "active" ? "Suspender" : "Reactivar"}
              </button>
              <select
                className={`${btn2} bg-background`}
                defaultValue=""
                disabled={grant.isPending}
                onChange={(e) => {
                  const p = plans.data?.find((x) => x.id === e.target.value);
                  if (p && confirm(`¿Regalar ${p.name} a ${u.display_name}?`))
                    grant.mutate({ u: u.id, p: p.id, m: p.months });
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Regalar membresía…
                </option>
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Subastas() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-auctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions_safe")
        .select(
          "id,title,status,current_price,starting_price,currency,bid_count,ends_at,auction_type,closing_mode,profiles!auctions_seller_id_fkey(display_name)",
        )
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data
        .filter((a) => a.id && a.status)
        .map((a) => ({ ...a, id: a.id ?? "", status: a.status ?? "" }));
    },
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const reason = prompt("Motivo de la cancelación") ?? "";
      if (!reason.trim()) throw new Error("Escribe un motivo");
      const { error } = await supabase.rpc("cancel_auction", { _auction_id: id, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subasta cancelada");
      qc.invalidateQueries({ queryKey: ["admin-auctions"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const st: Record<string, string> = {
    active: "Activa",
    scheduled: "Programada",
    ended_sold: "Vendida",
    ended_unsold: "Sin venta",
    cancelled: "Cancelada",
  };
  if (!q.data?.length)
    return <Empty>{q.isLoading ? "Cargando…" : "No hay subastas publicadas."}</Empty>;
  return (
    <div className="space-y-3">
      {q.data.map((a) => (
        <div key={a.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
          <div className="min-w-0">
            <Link
              to="/subastas/$id"
              params={{ id: a.id }}
              className="font-semibold hover:underline"
            >
              {a.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {a.auction_type === "service" ? "Servicio" : modeLabel(a.closing_mode)} ·{" "}
              {a.profiles?.display_name} · {a.currency} {a.current_price ?? a.starting_price} ·{" "}
              {a.bid_count} ofertas · cierra {fmtDate(a.ends_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs">
              {st[a.status] ?? a.status}
            </span>
            {(a.status === "active" || a.status === "scheduled") && (
              <button
                className={btn2}
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(a.id)}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Ajustes() {
  const q = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () =>
      (await supabase.from("platform_settings").select("*").eq("id", 1).single()).data,
  });
  if (!q.data) return <Empty>Cargando…</Empty>;
  return <AjustesForm s={q.data} />;
}

function AjustesForm({
  s,
}: {
  s: {
    min_increment: number;
    min_duration_hours: number;
    max_duration_days: number;
    extension_seconds: number;
  };
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    inc: String(s.min_increment),
    h: String(s.min_duration_hours),
    d: String(s.max_duration_days),
  });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_update_settings", {
        _min_increment: Number(f.inc),
        _min_hours: Number(f.h),
        _max_days: Number(f.d),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajustes guardados");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className={`${card} max-w-md space-y-3`}>
      <label className="block text-sm">
        Incremento mínimo permitido
        <input
          className={input}
          inputMode="decimal"
          value={f.inc}
          onChange={(e) => setF({ ...f, inc: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Duración mínima de artículos (horas)
        <input
          className={input}
          inputMode="numeric"
          value={f.h}
          onChange={(e) => setF({ ...f, h: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Duración máxima (días)
        <input
          className={input}
          inputMode="numeric"
          value={f.d}
          onChange={(e) => setF({ ...f, d: e.target.value })}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Extensión por oferta en el último minuto: {s.extension_seconds} segundos (fijo).
      </p>
      <button className={btn} disabled={m.isPending} onClick={() => m.mutate()}>
        Guardar
      </button>
    </div>
  );
}

function Registro() {
  const q = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () =>
      (
        await supabase
          .from("admin_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  if (!q.data?.length)
    return <Empty>{q.isLoading ? "Cargando…" : "Sin acciones registradas."}</Empty>;
  return (
    <div className="space-y-2">
      {q.data.map((r) => (
        <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
          <b>{r.action}</b> <span className="text-muted-foreground">· {fmtDate(r.created_at)}</span>
          {r.details && (
            <pre className="mt-1 overflow-x-auto text-xs text-muted-foreground">
              {JSON.stringify(r.details)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
