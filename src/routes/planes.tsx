import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, Empty } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { money, errMsg } from "@/lib/format";

export const Route = createFileRoute("/planes")({
  head: () => ({
    meta: [
      { title: "Membresías NEXO — Inicio, Impulso, Pro y Élite" },
      { name: "description", content: "Elige tu membresía NEXO: subasta más artículos, gana publicidad y comisiones por referidos." },
      { property: "og:title", content: "Membresías NEXO" },
      { property: "og:description", content: "Planes mensual, trimestral, semestral y anual con beneficios y referidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Plans,
});

const periodLabel: Record<string, string> = { monthly: "Mensual", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual" };

function Plans() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sel, setSel] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("*").eq("active", true).order("months")).data ?? [],
  });
  const methods = useQuery({
    queryKey: ["pay-methods"],
    queryFn: async () => (await supabase.from("payment_methods").select("*").eq("active", true).order("sort")).data ?? [],
  });
  const balance = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => Number((await supabase.rpc("wallet_balance", { _user: user!.id })).data ?? 0),
  });

  const plan = plans.data?.find((p) => p.id === sel);

  async function request() {
    if (!user || !plan) return;
    if (!method) return void toast.error("Elige un método de pago");
    if (ref.trim().length < 3) return void toast.error("Escribe la referencia o comprobante del pago");
    setBusy(true);
    const { error } = await supabase.from("subscription_requests").insert({ user_id: user.id, plan_id: plan.id, payment_method_id: method, reference: ref.trim() });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Solicitud enviada. Activaremos tu membresía al verificar el pago.");
    setSel(null); setRef("");
  }

  async function payWallet() {
    if (!plan) return;
    setBusy(true);
    const { error } = await supabase.rpc("pay_membership_with_wallet", { _plan: plan.id });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("¡Membresía activada con tu saldo!");
    qc.invalidateQueries();
    setSel(null);
  }

  return (
    <PageShell title="Membresías">
      <p className="mb-6 max-w-2xl text-muted-foreground">Con una membresía activa puedes subastar artículos y servicios, aparecer en espacios destacados y ganar comisiones por tus referidos.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.data?.map((p, i) => (
          <div key={p.id} className={`flex flex-col rounded-2xl border bg-card p-5 shadow-soft ${sel === p.id ? "border-primary ring-2 ring-primary" : "border-border"}`}>
            <span className={`mb-2 h-1.5 w-10 rounded-full ${["bg-nexo-red", "bg-nexo-blue", "bg-nexo-yellow", "bg-nexo-green"][i % 4]}`} />
            <h2 className="font-display text-xl font-bold">{p.name}</h2>
            <p className="text-sm text-muted-foreground">{periodLabel[p.period] ?? p.period}</p>
            <p className="my-3 font-display text-3xl font-bold">{money(p.price, p.currency)}</p>
            <ul className="mb-4 flex-1 space-y-1.5 text-sm">
              <li>• Hasta {p.max_active_auctions ?? "ilimitadas"} subastas activas</li>
              <li>• {Number(p.referral_pct)}% de comisión por referidos</li>
              {p.benefits.map((b) => <li key={b}>• {b}</li>)}
            </ul>
            {user ? (
              <Button variant={sel === p.id ? "default" : "outline"} onClick={() => setSel(p.id)}>Elegir</Button>
            ) : (
              <Button asChild variant="outline"><Link to="/auth" search={{ redirect: "/planes" }}>Entrar para elegir</Link></Button>
            )}
          </div>
        ))}
      </div>
      {plan && (
        <div className="mt-8 max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Pagar {plan.name} — {money(plan.price, plan.currency)}</h2>
          {balance.data !== undefined && balance.data >= Number(plan.price) && (
            <Button className="w-full" disabled={busy} onClick={payWallet}>Pagar con mi saldo ({money(balance.data)})</Button>
          )}
          {methods.data?.length ? (
            <>
              <div className="space-y-2">
                {methods.data.map((m) => (
                  <label key={m.id} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3">
                    <input type="radio" name="pm" checked={method === m.id} onChange={() => setMethod(m.id)} />
                    <span><b>{m.name}</b><span className="block whitespace-pre-line text-sm text-muted-foreground">{m.instructions}</span></span>
                  </label>
                ))}
              </div>
              <Input placeholder="Número de referencia o comprobante" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} />
              <Button className="w-full" disabled={busy} onClick={request}>Enviar comprobante</Button>
            </>
          ) : (
            <Empty>Aún no hay métodos de pago disponibles. Vuelve pronto.</Empty>
          )}
        </div>
      )}
    </PageShell>
  );
}
