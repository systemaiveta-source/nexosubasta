import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, MapPin, ShieldCheck, ShieldAlert, Star, Truck, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout, Empty, BackButton } from "@/components/SiteLayout";
import { StatusBadge, useNow } from "@/components/AuctionCard";
import { useImageUrls } from "@/lib/images";
import { useAuth, useRoles } from "@/lib/auth";
import { errMsg, minNextBid, money, newIdempotencyKey, scopeLabel, timeLeft } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { parseAuctionMethods } from "@/lib/auction-payments";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { deliveryModes, parseDelivery } from "@/lib/delivery";
import { getServiceRequest } from "@/lib/auction-details.functions";
import { SERVICE_CATALOG, type ServiceRequest } from "@/lib/service-catalog";
import { ServiceRouteMap } from "@/components/ServiceRouteMap";
import { AuctionShare } from "@/components/AuctionShare";
import { getAuctionShare } from "@/lib/auction-share.functions";
import { auctionShareHead } from "@/lib/auction-share";
import { modeLabel } from "@/lib/auction-timing";
import { getItemAttributeFields } from "@/components/ItemCategoryForm";

export const Route = createFileRoute("/subastas/$id")({
  staticData: { sitemap: true },
  loader: ({ params }) => getAuctionShare({ data: { id: params.id } }),
  head: ({ params, loaderData }) => auctionShareHead(params.id, loaderData ?? null),
  component: AuctionPage,
});

const AUCTION_COLUMNS =
  "id,seller_id,title,description,category_id,country,city,scope,delivery_terms,images,starting_price,min_increment,currency,status,starts_at,ends_at,original_ends_at,current_price,bid_count,leader_id,winner_id,has_reserve,reserve_met,extensions_count,auction_type,selection_pending,accepted_payment_methods,delivery_snapshot,closing_mode,quiet_period_seconds,quiet_period_minutes,rules_version,extension_pending,closing_phase";

function AuctionPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { isStaff } = useRoles();
  const qc = useQueryClient();
  const now = useNow();
  const [imgIdx, setImgIdx] = useState(0);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [conditions, setConditions] = useState("");
  const keyRef = useRef<string>(newIdempotencyKey());
  const closingRef = useRef(false);

  const auction = useQuery({
    queryKey: ["auction", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions_safe")
        .select(AUCTION_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id || !data.seller_id || !data.title || !data.status || !data.currency)
        return null;
      return {
        ...data,
        id: data.id,
        seller_id: data.seller_id,
        title: data.title,
        status: data.status,
        currency: data.currency,
        images: data.images ?? [],
        scope: data.scope ?? "national",
        extensions_count: data.extensions_count ?? 0,
      };
    },
  });
  const a = auction.data;
  const serviceDetails = useQuery({
    queryKey: ["service-details", id, user?.id],
    enabled: !!user && a?.auction_type === "service",
    retry: false,
    queryFn: () => getServiceRequest({ data: { id } }),
  });
  const itemDetails = useQuery({
    queryKey: ["item-details", id],
    enabled: a?.auction_type === "item",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_item_details")
        .select("category_slug,subcategory_name,attributes")
        .eq("auction_id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, attributes: data.attributes as unknown as Record<string, string> } : null;
    },
  });
  const request = serviceDetails.data as unknown as
    (ServiceRequest & { locations_verified: boolean }) | null;
  const serviceCategory = SERVICE_CATALOG.find((entry) => entry.id === request?.category);
  useEffect(() => {
    setAccepted(false);
  }, [id, a?.delivery_snapshot, a?.accepted_payment_methods]);

  const bids = useQuery({
    queryKey: ["bids", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bids")
        .select("id,bidder_id,amount,conditions,created_at")
        .eq("auction_id", id)
        .order("amount", { ascending: a?.auction_type === "service" })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const seller = useQuery({
    queryKey: ["profile-pub", a?.seller_id],
    enabled: !!a?.seller_id,
    queryFn: async () => {
      if (!a?.seller_id) return null;
      const [p, r] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,display_name,country,city")
          .eq("id", a.seller_id)
          .maybeSingle(),
        supabase
          .from("user_reputation")
          .select("review_count,avg_rating")
          .eq("user_id", a.seller_id)
          .maybeSingle(),
      ]);
      return { profile: p.data, rep: r.data };
    },
  });

  const imgs = useImageUrls(a?.images);

  useEffect(() => {
    const ch = supabase
      .channel(`auction-${id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["auction", id] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["bids", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  // Ask the server to close/activate as soon as the official time passes (server decides).
  useEffect(() => {
    if (!a || closingRef.current) return;
    const due =
      (a.status === "active" && a.ends_at && new Date(a.ends_at).getTime() <= now) ||
      (a.status === "scheduled" && a.starts_at && new Date(a.starts_at).getTime() <= now);
    if (due) {
      closingRef.current = true;
      supabase.rpc("close_if_due", { _auction_id: id }).then(() => {
        setTimeout(() => {
          closingRef.current = false;
          qc.invalidateQueries({ queryKey: ["auction", id] });
        }, 1500);
      });
    }
  }, [a, now, id, qc]);

  if (auction.isLoading)
    return (
      <SiteLayout>
        <div className="mx-auto max-w-6xl p-8">
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      </SiteLayout>
    );
  if (!a)
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl p-8">
          <Empty>Esta subasta no existe o no está disponible.</Empty>
        </div>
      </SiteLayout>
    );

  const minBid =
    a.auction_type === "service"
      ? 0.01
      : minNextBid(
          Number(a.starting_price),
          a.current_price === null ? null : Number(a.current_price),
          Number(a.min_increment),
        );
  const isSeller = user?.id === a.seller_id;
  const isLeader = user?.id === a.leader_id;
  const ended = a.status !== "active" && a.status !== "scheduled";
  const msLeft = a.ends_at ? new Date(a.ends_at).getTime() - now : 0;
  const methods = parseAuctionMethods(a.accepted_payment_methods);
  const delivery = parseDelivery(a.delivery_snapshot);
  const canBid =
    a.status === "active" &&
    msLeft > 0 &&
    !!user &&
    !isSeller &&
    !isLeader &&
    ((methods.length === 0 && !delivery) || accepted) &&
    (a.auction_type !== "service" || !!request);

  async function placeBid(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      toast.error("Sin conexión: tu oferta no se ha enviado. Conéctate e inténtalo de nuevo.");
      return;
    }
    const value = Number(amount);
    if (
      !Number.isFinite(value) ||
      value < minBid ||
      (a?.auction_type === "service" &&
        a.current_price !== null &&
        value > Number(a.current_price) - Number(a.min_increment))
    ) {
      toast.error(`La oferta mínima es ${money(minBid, a?.currency ?? "USD")}`);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("bid_with_delivery_acceptance", {
        _auction: id,
        _amount: value,
        _key: keyRef.current,
        _accept: accepted,
        _terms: a?.accepted_payment_methods ?? [],
        _conditions: conditions,
        _delivery: a?.delivery_snapshot ?? null,
      });
      if (error) throw error;
      const r = data as { extended?: boolean; duplicate?: boolean };
      keyRef.current = newIdempotencyKey();
      setAmount("");
      setConditions("");
      toast.success(
        r.extended && Number(a?.rules_version ?? 1) < 3
          ? a?.closing_mode === "reserve"
            ? "Oferta aceptada. Período de cierre reiniciado."
            : "Oferta aceptada. El cierre se amplió 60 segundos."
          : "Oferta aceptada",
      );
      qc.invalidateQueries({ queryKey: ["auction", id] });
      qc.invalidateQueries({ queryKey: ["bids", id] });
    } catch (err) {
      // Network failures keep the same key so a retry can't create a duplicate bid.
      const m = errMsg(err);
      if (!/fetch|network/i.test(m)) keyRef.current = newIdempotencyKey();
      toast.error(
        /fetch|network/i.test(m)
          ? "No pudimos confirmar tu oferta. Revisa tu conexión y vuelve a intentarlo."
          : m,
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    const reason =
      isStaff && !isSeller ? prompt("Motivo de la cancelación") : "Cancelada por el vendedor";
    if (reason === null) return;
    const { error } = await supabase.rpc("cancel_auction", { _auction_id: id, _reason: reason });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("Subasta cancelada");
    qc.invalidateQueries({ queryKey: ["auction", id] });
  }

  const bidderLabel = (() => {
    const map = new Map<string, number>();
    return (bidderId: string) => {
      if (bidderId === user?.id) return "Tú";
      if (!map.has(bidderId)) map.set(bidderId, map.size + 1);
      return `Postor ${map.get(bidderId)}`;
    };
  })();

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <BackButton fallback="/subastas" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-8 pt-2 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
            {(() => {
              const k = a.images[imgIdx];
              const u = k ? imgs.data?.[k] : undefined;
              return u ? (
                <img src={u} alt={a.title} className="h-full w-full object-contain" />
              ) : null;
            })()}
          </div>
          {a.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {a.images.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setImgIdx(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${i === imgIdx ? "border-primary" : "border-transparent"}`}
                >
                  {imgs.data?.[p] && (
                    <img src={imgs.data[p]} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="mt-8 space-y-4">
            <h2 className="font-display text-xl font-semibold">Descripción</h2>
            <p className="whitespace-pre-line leading-relaxed text-foreground/90">
              {a.description}
            </p>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-nexo-red" />
                {[a.city, a.country].filter(Boolean).join(", ") || "Sin ubicación"} ·{" "}
                {scopeLabel[a.scope]}
              </p>
              <p className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 text-nexo-blue" />
                {delivery ? (
                  <span>
                    {deliveryModes[delivery.mode]}
                    {delivery.mode === "paid"
                      ? ` · ${money(delivery.cost, a.currency)} adicionales`
                      : ""}
                    <br />
                    {delivery.conditions}
                  </span>
                ) : (
                  a.delivery_terms || "Entrega por acordar; no se asume envío gratuito"
                )}
              </p>
            </div>
          </div>
          {a.auction_type === "item" && itemDetails.data && (
            <section className="mt-6 space-y-3 border-y border-border py-4">
              <div>
                <h2 className="font-semibold">Características del artículo</h2>
                <p className="text-sm text-muted-foreground">{itemDetails.data.subcategory_name}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {getItemAttributeFields(itemDetails.data.category_slug)
                  .filter((field) => itemDetails.data?.attributes?.[field.key])
                  .map((field) => (
                    <div key={field.key}>
                      <dt className="font-medium">{field.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-muted-foreground">{itemDetails.data?.attributes[field.key]}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
          {a.auction_type === "service" && (
            <section className="mt-6 space-y-3 border-y border-border py-4">
              <h2 className="font-semibold">Detalles para cotizar</h2>
              {request && serviceCategory ? (
                <>
                  <p>
                    {serviceCategory.name} · {request.subcategory}
                  </p>
                  <dl className="space-y-3 text-sm">
                    {serviceCategory.fields
                      .filter(
                        (field) =>
                          request.values[field.key] &&
                          (!field.when || request.values[field.when[0]] === field.when[1]),
                      )
                      .map((field) => (
                        <div key={field.key}>
                          <dt className="font-medium">{field.label}</dt>
                          <dd className="whitespace-pre-wrap break-words text-muted-foreground">
                            {request.values[field.key]}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  {request.category === "transport" && (
                    <ServiceRouteMap
                      origin={request.values["origin"] ?? ""}
                      destination={request.values["destination"] ?? ""}
                      verified={request.locations_verified}
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Información privada disponible para el cliente y proveedores con membresía activa.
                  No puedes ofertar sin acceder a los detalles completos.
                </p>
              )}
            </section>
          )}
          {methods.length > 0 && (
            <section className="mt-6 space-y-2 border-b border-border pb-4">
              <h2 className="font-semibold">
                {a.auction_type === "service" ? "Métodos de pago para el servicio" : "Métodos de pago aceptados"}
              </h2>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {methods.map((method, index) => (
                  <li key={index}>
                    {method.name}
                    {method.asset ? ` · ${method.asset}` : ""}
                    {method.network ? ` · ${method.network}` : ""}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Los números de cuenta, usuarios, enlaces y direcciones de billetera se comparten únicamente en el chat privado.
              </p>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={a.status} />
              {a.auction_type === "service" && (
                <span className="text-xs text-muted-foreground">Solicitud de servicio</span>
              )}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
              {a.title}
            </h1>
            {a.status !== "draft" && (
              <div className="mt-3">
                <AuctionShare id={id} title={a.title} />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {a.auction_type === "service"
                    ? "Oferta más baja"
                    : a.current_price
                      ? "Oferta más alta"
                      : "Precio inicial"}
                </p>
                <p className="font-display text-3xl font-bold">
                  {a.auction_type === "service" && a.current_price === null
                    ? "Sin ofertas"
                    : money(a.current_price ?? a.starting_price, a.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.bid_count} ofertas · incremento mínimo {money(a.min_increment, a.currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {a.status === "scheduled"
                    ? "Empieza en"
                    : a.bid_count === 0 && !ended
                      ? "Sin ofertas"
                      : "Termina en"}
                </p>
                {a.status === "active" && a.bid_count === 0 ? (
                  <>
                    <p className="font-display text-lg font-bold">
                      La cuenta regresiva inicia con la 1.ª puja
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      Sin ofertas, finaliza en {timeLeft(a.ends_at, now)}
                    </p>
                  </>
                ) : (
                  <p
                    className={`font-display text-xl font-bold tabular-nums ${msLeft < 60000 && a.status === "active" ? "text-nexo-red" : ""}`}
                  >
                    {a.status === "scheduled"
                      ? timeLeft(a.starts_at, now)
                      : ended
                        ? "Finalizada"
                        : timeLeft(a.ends_at, now)}
                  </p>
                )}
              </div>
            </div>
            {a.has_reserve && (
              <p
                className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${a.reserve_met ? "bg-nexo-green/10 text-nexo-green" : "bg-nexo-yellow/15 text-accent-foreground"}`}
              >
                {a.reserve_met ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                {a.reserve_met
                  ? "Precio de reserva alcanzado"
                  : "Precio de reserva aún no alcanzado"}
              </p>
            )}
            {a.extensions_count > 0 && Number(a.rules_version ?? 1) < 4 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Cierre ampliado {a.extensions_count} {a.extensions_count === 1 ? "vez" : "veces"}{" "}
                {a.closing_mode === "reserve"
                  ? "por ofertas válidas tras alcanzar la reserva."
                  : "por ofertas de último minuto."}
              </p>
            )}
            {a.auction_type === "item" && (
              <p className="mt-3 font-semibold">
                {modeLabel(a.closing_mode)}
                {a.status === "ended_unsold" && a.bid_count === 0 ? " · Sin ofertas" : ""}
              </p>
            )}
            {a.auction_type === "item" && Number(a.rules_version ?? 1) >= 3 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {a.extension_pending
                  ? "Plazo cumplido. El subastador debe decidir si extiende 7 días o finaliza sin ganador. No se aceptan ofertas mientras decide."
                  : a.closing_mode === "fixed" && a.bid_count === 0
                    ? "Esperando la primera puja válida: entonces comienza la duración elegida. Sin ofertas, finaliza a los 8 días."
                    : a.closing_mode === "fixed"
                      ? "El plazo desde la primera puja válida no se amplía."
                      : a.closing_mode === "flash" && Number(a.rules_version ?? 1) >= 5
                        ? "La primera puja válida inicia la prórroga elegida y cada nueva puja la reinicia completa; al vencer sin otra puja, gana la mejor oferta. Sin ofertas, termina a los 7 días de publicación. No hay extensión manual."
                        : a.closing_mode === "flash"
                          ? "La primera puja inicia 7 días de ofertas; después, cada puja reinicia la prórroga completa. Sin primera puja, termina sin ofertas a los 7 días de publicación. No hay extensión manual."
                        : Number(a.rules_version ?? 1) >= 4
                          ? "Al alcanzar la reserva, cada puja reinicia la prórroga completa. Sin reserva, comienza con la primera puja. Si la reserva no se alcanza en 7 días, el subastador puede extender una sola vez 7 días o finalizar sin ganador."
                          : "Las pujas válidas reinician la espera cuando se cumplen las condiciones de venta, sin superar el límite vigente."}
                {!a.has_reserve && " Sin reserva gana el mejor postor válido."}
              </p>
            )}
            {(a.closing_mode === "reserve" || a.closing_mode === "flash") && (
              <p className="mt-2 text-sm text-muted-foreground">
                Prórroga sin nuevas pujas:{" "}
                {a.quiet_period_minutes ?? Math.ceil(Number(a.quiet_period_seconds) / 60)} minutos.
              </p>
            )}

            {a.status === "active" && msLeft > 0 && (
              <div className="mt-5">
                {!user ? (
                  <Link
                    to="/auth"
                    search={{ redirect: `/subastas/${id}` }}
                    className="block rounded-lg bg-primary px-4 py-3 text-center font-semibold text-primary-foreground"
                  >
                    Entra para ofertar
                  </Link>
                ) : isSeller ? (
                  <p className="text-sm text-muted-foreground">
                    Es tu subasta: no puedes ofertar en ella.
                  </p>
                ) : isLeader ? (
                  <p className="rounded-lg bg-nexo-green/10 px-3 py-2 text-sm font-medium text-nexo-green">
                    Tienes la oferta líder.
                  </p>
                ) : (
                  <form onSubmit={placeBid} className="space-y-2">
                    {a.auction_type === "service" && (
                      <Textarea
                        aria-label="Experiencia y condiciones"
                        placeholder="Experiencia, fecha disponible y condiciones del servicio"
                        value={conditions}
                        onChange={(e) => setConditions(e.target.value)}
                        required
                        minLength={5}
                        maxLength={2000}
                      />
                    )}
                    {(methods.length > 0 || delivery) && (
                      <div className="space-y-2 border-y border-border py-3">
                        <p className="text-sm font-semibold">Confirma las condiciones de pago</p>
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                          />
                          Acepto los métodos de pago indicados${delivery ? " y las condiciones de entrega${delivery ? "}. NEXO no procesa ni verifica el pago.
                        </label>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={minBid}
                        placeholder={`${minBid} o más`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                      <Button type="submit" disabled={busy || !canBid} className="shrink-0">
                        {busy ? "Enviando…" : "Ofertar"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.auction_type === "service"
                        ? a.current_price === null
                          ? "Indica el importe por tu servicio. El cliente elige al proveedor."
                          : `Oferta máxima: ${money(Number(a.current_price) - Number(a.min_increment), a.currency)}. El cliente elige al proveedor.`
                        : `Oferta mínima: ${money(minBid, a.currency)}. Cada oferta es un compromiso de compra.`}
                    </p>
                    {typeof navigator !== "undefined" && !navigator.onLine && (
                      <p className="flex items-center gap-1 text-xs text-nexo-red">
                        <WifiOff className="h-3 w-3" /> Sin conexión: no se pueden enviar ofertas.
                      </p>
                    )}
                  </form>
                )}
              </div>
            )}
            {a.status === "ended_sold" && (
              <p className="mt-4 text-sm font-medium">
                {a.winner_id === user?.id
                  ? "¡Ganaste esta subasta! Revisa tu centro de operaciones."
                  : "Subasta adjudicada."}
              </p>
            )}
            {a.status === "ended_unsold" && (
              <p className="mt-4 text-sm text-muted-foreground">
                {a.selection_pending
                  ? "Plazo finalizado. El cliente puede elegir una oferta."
                  : "Finalizó sin adjudicación."}
              </p>
            )}
            {(a.status === "active" || a.status === "scheduled") &&
              ((isSeller && a.bid_count === 0) || isStaff) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-destructive"
                  onClick={cancel}
                >
                  Cancelar subasta
                </Button>
              )}
          </div>

          {seller.data?.profile && (
            <Link
              to="/usuarios/$id"
              params={{ id: a.seller_id }}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-secondary/50"
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {a.auction_type === "service" ? "Cliente" : "Subastador"}
                </p>
                <p className="font-semibold">{seller.data.profile.display_name}</p>
              </div>
              <p className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-nexo-yellow text-nexo-yellow" />
                {seller.data.rep
                  ? `${seller.data.rep.avg_rating} (${seller.data.rep.review_count})`
                  : "Sin valoraciones"}
              </p>
            </Link>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Historial de ofertas</h2>
            {bids.data?.length ? (
              <ul className="divide-y divide-border text-sm">
                {bids.data.map((b, i) => (
                  <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className={i === 0 ? "font-semibold" : ""}>
                      {bidderLabel(b.bidder_id)}
                    </span>
                    <span className="tabular-nums">{money(b.amount, a.currency)}</span>
                    <span className="text-muted-foreground">
                      {new Date(b.created_at).toLocaleString("es")}
                    </span>
                    {b.conditions && (
                      <p className="w-full whitespace-pre-wrap break-words">{b.conditions}</p>
                    )}
                    {a.auction_type === "service" &&
                      isSeller &&
                      (a.status === "active" || a.selection_pending) && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={async () => {
                            if (!confirm("¿Elegir esta oferta y abrir la operación privada?"))
                              return;
                            setBusy(true);
                            try {
                              const result = await supabase.rpc("choose_service_provider", {
                                _auction: id,
                                _bid: b.id,
                              });
                              if (result.error) throw result.error;
                              toast.success("Proveedor elegido. Revisa Operaciones.");
                              qc.invalidateQueries({ queryKey: ["auction", id] });
                            } catch (e) {
                              toast.error(errMsg(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Elegir proveedor
                        </Button>
                      )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay ofertas.</p>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
