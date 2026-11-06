import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { money, errMsg, statusLabel, timeLeft } from "@/lib/format";
import { useNow } from "@/components/AuctionCard";
import { CatalogSelect } from "@/components/CatalogSelect";
import { Textarea } from "@/components/ui/textarea";
import { getMyMembership, listMyPublications } from "@/lib/profiles.functions";
import { MembershipSupport } from "@/components/MembershipSupport";

export const Route = createFileRoute("/_authenticated/perfil")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Mi perfil, saldo y referidos — NEXO" },
      {
        name: "description",
        content: "Gestiona tus datos, tu membresía, tu saldo y tu enlace de referidos en NEXO.",
      },
      { property: "og:title", content: "Mi perfil — NEXO" },
      { property: "og:description", content: "Perfil, saldo y referidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["myprofile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const {data, error} = await supabase.rpc("my_profile");
      if (error) throw error;
      return data;
    },
  });
  const publications = useQuery({queryKey: ["mine", user?.id], enabled: !!user, queryFn: () => listMyPublications()});
  const membership = useQuery({queryKey: ["membership-benefits", user?.id], enabled: !!user, queryFn: () => getMyMembership()});
  const balance = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () =>
      Number((await supabase.rpc("wallet_balance", { _user: user?.id ?? "" })).data ?? 0),
  });
  const ledger = useQuery({
    queryKey: ["ledger", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", user?.id ?? "")
          .order("created_at", { ascending: false })
          .limit(30)
      ).data ?? [],
  });
  const subs = useQuery({
    queryKey: ["mysubs", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("subscriptions")
          .select("id,status,ends_at,plans(name)")
          .eq("user_id", user?.id ?? "")
          .order("ends_at", { ascending: false })
      ).data ?? [],
  });
  const referrals = useQuery({
    queryKey: ["refs", user?.id],
    queryFn: async () =>
      (await supabase.rpc("my_referral_community")).data ?? [],
  });
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () =>
      (await supabase.from("plans").select("*").eq("active", true).order("months")).data ?? [],
  });

  const [form, setForm] = useState({
    display_name: "",
    country: "",
    city: "",
    phone: "",
    bio: "",
    currency: "USD",
  });
  useEffect(() => {
    const p = profile.data;
    if (p)
      setForm({
        display_name: p.display_name,
        country: p.country ?? "",
        city: p.city ?? "",
        phone: p.phone ?? "",
        bio: p.bio ?? "",
        currency: p.currency,
      });
  }, [profile.data]);
  const [to, setTo] = useState({ code: "", amount: "" });
  const [gift, setGift] = useState({ code: "", plan: "" });

  const link = profile.data?.referral_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${profile.data.referral_code}`
    : "";

  async function save() {
    const { error } = await supabase
      .from("profiles")
      .update(form)
      .eq("id", user?.id ?? "");
    if (error) toast.error(errMsg(error));
    else {
      toast.success("Perfil guardado");
      qc.invalidateQueries({ queryKey: ["myprofile"] });
    }
  }
  async function transfer() {
    const { error } = await supabase.rpc("transfer_credit", {
      _to_code: to.code.trim(),
      _amount: Number(to.amount),
    });
    if (error) toast.error(errMsg(error));
    else {
      toast.success("Saldo transferido");
      setTo({ code: "", amount: "" });
      qc.invalidateQueries();
    }
  }
  async function payForOther() {
    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", gift.code.trim())
      .maybeSingle();
    if (!target) return void toast.error("Código de usuario no encontrado");
    const { error } = await supabase.rpc("pay_membership_with_wallet", {
      _plan: gift.plan,
      _for_user: target.id,
    });
    if (error) toast.error(errMsg(error));
    else {
      toast.success("Membresía pagada");
      qc.invalidateQueries();
    }
  }

  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const box = "space-y-3 rounded-2xl border border-border bg-card p-6";

  return (
    <PageShell title="Mi perfil" actions={user && <Link to="/usuarios/$id" params={{id: user.id}} className="text-sm underline">Ver perfil público</Link>}>
      <MyPublications publications={publications} />
      {profile.error && <p role="alert" className="mb-4 text-destructive">No se pudo cargar tu perfil. <Button variant="outline" onClick={() => profile.refetch()}>Reintentar</Button></p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={box}>
          <h2 className="font-display text-lg font-bold">Datos</h2>
          <div className="space-y-1.5">
            <Label>Nombre visible</Label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>País</Label>
              <CatalogSelect
                kind="country"
                label="País"
                value={form.country}
                onChange={(country) => setForm({ ...form, country })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda preferida</Label>
              <CatalogSelect
                kind="currency"
                label="Moneda preferida"
                value={form.currency}
                onChange={(currency) => setForm({ ...form, currency })}
              />
            </div>
          </div>
          <Label>Biografía pública</Label>
          <Textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} maxLength={1000}/>
          <Button onClick={save} disabled={!profile.data || profile.isPending}>Guardar</Button>
        </section>

        <section className={box}>
          <h2 className="font-display text-lg font-bold">Membresía</h2>
          {membership.data?.name && <div className="space-y-2 text-sm">
            <p className="font-semibold">{membership.data.name}{membership.data.badge ? ` · Insignia ${membership.data.badge}` : ""}</p>
            <p>Hasta {membership.data.max_active_auctions ?? "ilimitadas"} subastas activas · Comisión: {membership.data.referral_pct}%</p>
            {membership.data.featured_interval !== "none" && <p>Publicidad destacada: {membership.data.featured_interval === "always" ? "permanente" : `${membership.data.featured_interval === "weekly" ? "semanal" : "mensual"}, 24 horas por aparición`}{membership.data.featured ? " · Activa ahora" : ""}</p>}
            {membership.data.priority_support && <p>Atención prioritaria</p>}
          </div>}
          {subs.data?.length ? (
            subs.data.map((s) => (
              <p key={s.id} className="text-sm">
                {(s.plans as { name: string } | null)?.name} —{" "}
                {s.status === "active" && new Date(s.ends_at) > new Date() ? "activa" : "vencida"}{" "}
                hasta {new Date(s.ends_at).toLocaleDateString("es")}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sin membresía activa.</p>
          )}
          <h2 className="pt-3 font-display text-lg font-bold">Referidos</h2>
          <p className="text-sm text-muted-foreground">
            Comparte tu enlace. Ganas 5%, 10%, 15% o 20% de cada membresía que activen tus
            referidos, según tu propio plan (debe estar activo). Las ganancias no se retiran en
            efectivo: úsalas para membresías o transfiérelas.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={link} />
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Enlace copiado");
              }}
            >
              Copiar
            </Button>
          </div>
          <p className="text-sm">
            Tu código: <b>{profile.data?.referral_code}</b> · Referidos:{" "}
            <b>{referrals.data?.length ?? 0}</b> · Con plan activo:{" "}
            <b>{referrals.data?.filter((r) => r.plan_active).length ?? 0}</b>
          </p>
          <h3 className="pt-2 font-semibold">Mi comunidad</h3>
          {referrals.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : referrals.data?.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {referrals.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.plan_active
                        ? `Plan ${r.plan_name} activo${r.ends_at ? ` hasta ${new Date(r.ends_at).toLocaleDateString("es")}` : ""}`
                        : "Sin plan activo"}
                    </p>
                  </div>
                  <span className="font-semibold">
                    Recompensa: {Number(r.earned).toFixed(2)} {r.currency ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no tienes referidos. Comparte tu enlace para empezar tu comunidad.
            </p>
          )}
          <p className="text-sm">
            Total ganado por referidos:{" "}
            <b>
              {(referrals.data ?? []).reduce((a, r) => a + Number(r.earned), 0).toFixed(2)}
            </b>
          </p>
        </section>

        <section className={box}>
          <h2 className="font-display text-lg font-bold">Saldo: {money(balance.data ?? 0)}</h2>
          <Label>Transferir saldo a otro usuario</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Código del usuario"
              value={to.code}
              onChange={(e) => setTo({ ...to, code: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Monto"
              value={to.amount}
              onChange={(e) => setTo({ ...to, amount: e.target.value })}
              className="w-28"
            />
            <Button onClick={transfer}>Enviar</Button>
          </div>
          <Label>Pagar la membresía de otra persona</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Código del usuario"
              value={gift.code}
              onChange={(e) => setGift({ ...gift, code: e.target.value })}
            />
            <select
              className={sel}
              value={gift.plan}
              onChange={(e) => setGift({ ...gift, plan: e.target.value })}
            >
              <option value="">Plan…</option>
              {plans.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {money(p.price)}
                </option>
              ))}
            </select>
            <Button onClick={payForOther} disabled={!gift.plan}>
              Pagar
            </Button>
          </div>
        </section>

        <section className={box}>
          <h2 className="font-display text-lg font-bold">Movimientos</h2>
          {ledger.data?.length ? (
            <ul className="space-y-1 text-sm">
              {ledger.data.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("es")} · {t.note}
                  </span>
                  <b className={Number(t.amount) < 0 ? "text-destructive" : ""}>
                    {money(t.amount, t.currency)}
                  </b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
          )}
        </section>
      </div>
      <MembershipSupport />
    </PageShell>
  );
}

type Publication = {
  id: string;
  title: string;
  status: string;
  bid_count: number;
  ends_at: string | null;
};

function MyPublications({
  publications,
}: {
  publications: {
    isPending: boolean;
    error: unknown;
    refetch: () => void;
    data?: Publication[] | undefined;
  };
}) {
  const qc = useQueryClient();
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const all = publications.data ?? [];
  const active = all.filter((a) => a.status === "active" || a.status === "scheduled");
  const expiredNoBids = all.filter(
    (a) => a.status === "ended_unsold" && a.bid_count === 0,
  );

  async function renew(a: Publication) {
    setBusy(a.id);
    try {
      const { error } = await supabase.rpc("republish_auction", { _auction: a.id });
      if (error) throw error;
      toast.success("Se creó un borrador para renovarla. Publícala desde Subastar.");
      qc.invalidateQueries({ queryKey: ["mine"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: Publication) {
    if (!confirm(`¿Eliminar "${a.title}" del sistema? Esta acción no se puede deshacer.`))
      return;
    setBusy(a.id);
    try {
      const { error } = await supabase.rpc("delete_unsold_auction", { _auction_id: a.id });
      if (error) throw error;
      toast.success("Publicación eliminada");
      qc.invalidateQueries({ queryKey: ["mine"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-8 space-y-3 border-b border-border pb-6">
      <h2 className="font-display text-xl font-bold">Mis publicaciones</h2>
      {publications.isPending ? (
        <p>Cargando…</p>
      ) : publications.error ? (
        <p role="alert">
          No se pudieron cargar tus publicaciones.{" "}
          <Button variant="outline" onClick={() => publications.refetch()}>
            Reintentar
          </Button>
        </p>
      ) : (
        <>
          {active.length ? (
            <ul className="divide-y divide-border">
              {active.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <Link
                    to="/subastas/$id"
                    params={{ id: a.id }}
                    className="min-w-0 break-words font-semibold underline"
                  >
                    {a.title}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {statusLabel[a.status] ?? a.status} · {a.bid_count} ofertas
                    {a.status === "active" && a.bid_count > 0 && a.ends_at
                      ? ` · Termina en ${timeLeft(a.ends_at, now)}`
                      : a.status === "active"
                        ? " · Esperando la 1.ª puja"
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No tienes subastas activas.</p>
          )}
          {expiredNoBids.length > 0 && (
            <div className="space-y-2 pt-3">
              <h3 className="font-semibold">Vencidas sin ofertas</h3>
              <p className="text-sm text-muted-foreground">
                Puedes renovarlas como borrador o eliminarlas del sistema.
              </p>
              <ul className="divide-y divide-border">
                {expiredNoBids.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <span className="min-w-0 break-words font-medium">{a.title}</span>
                    <span className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === a.id}
                        onClick={() => renew(a)}
                      >
                        Renovar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy === a.id}
                        onClick={() => remove(a)}
                      >
                        Eliminar
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <Link to="/vendedor" className="inline-block text-sm underline">
        Subastar o editar borradores
      </Link>
    </section>
  );
}
