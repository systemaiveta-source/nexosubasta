import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, Empty } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useRoles } from "@/lib/auth";
import { errMsg } from "@/lib/format";
import { uploadAuctionImage, useImageUrls } from "@/lib/images";
import { CatalogSelect } from "@/components/CatalogSelect";
import { DeliveryForm } from "@/components/DeliveryForm";
import { verifyServiceLocations } from "@/lib/service-locations.functions";
import { ServiceRequestForm } from "@/components/ServiceRequestForm";
import { deliverySchema, parseDelivery, type Delivery } from "@/lib/delivery";
import { emptyServiceRequest, type ServiceRequest } from "@/lib/service-catalog";
import { saveExtendedDraft } from "@/lib/auction-details.functions";
import { useServerFn } from "@tanstack/react-start";
import { QUIET_MINUTES } from "@/lib/auction-timing";
import { ItemCategoryForm, validateItemAttributes } from "@/components/ItemCategoryForm";
import { AuctionPaymentMethods } from "@/components/AuctionPaymentMethods";
import { parseAuctionMethods, type AuctionMethod } from "@/lib/auction-payments";

export const Route = createFileRoute("/_authenticated/vendedor")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Subastar en NEXO — Publica tu subasta" },
      {
        name: "description",
        content: "Publica artículos o solicita servicios en subasta desde tu dispositivo.",
      },
      { property: "og:title", content: "Subastar en NEXO" },
      { property: "og:description", content: "Crea y gestiona tus subastas en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Seller,
});

const SERVICE_MINUTES = [
  [1, "1 minuto"],
  [10, "10 minutos"],
  [20, "20 minutos"],
  [60, "1 hora"],
  [120, "2 horas"],
  [180, "3 horas"],
  [720, "12 horas"],
  [1440, "24 horas"],
  [10080, "1 semana"],
] as const;

function Seller() {
  const { user } = useAuth();
  const { isSeller } = useRoles();
  const qc = useQueryClient();
  const [type, setType] = useState<"item" | "service">("item");
  const [f, setF] = useState({
    title: "",
    description: "",
    category_id: "",
    country: "",
    city: "",
    scope: "national",
    delivery_terms: "",
    starting_price: "",
    min_increment: "1",
    currency: "USD",
    duration_hours: "24",
    duration_minutes: "60",
    service_from: "",
    service_to: "",
    reserve: "",
    expected: "",
    closing_mode: "",
    quiet_period_minutes: "5",
  });
  const [startsAt, setStartsAt] = useState("");
  const [methods, setMethods] = useState<AuctionMethod[]>([]);
  const [delivery, setDelivery] = useState<Delivery>({
    mode: "pickup",
    cost: null,
    conditions: "",
  });
  const [request, setRequest] = useState<ServiceRequest>(emptyServiceRequest);
  const [itemAttributes, setItemAttributes] = useState<Record<string, string>>({});
  const saveDraft = useServerFn(saveExtendedDraft);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (
        await supabase
          .from("categories")
          .select("id,name,slug,parent_id")
          .eq("active", true)
          .neq("slug", "nft-cripto")
          .order("sort")
      ).data ?? [],
  });
  const profile = useQuery({
    queryKey: ["myprofile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const {data, error} = await supabase.rpc("my_profile");
      if (error) throw error;
      return data;
    },
  });
  const sub = useQuery({
    queryKey: ["sub", user?.id],
    queryFn: async () =>
      (await supabase.rpc("has_active_seller_sub", { _user_id: user?.id ?? "" })).data ?? false,
  });
  const previews = useImageUrls(images);

  if (!isSeller)
    return (
      <PageShell title="Quiero subastar">
        <div className="max-w-lg space-y-4">
          <p className="text-muted-foreground">
            Activa tu cuenta de subastador para publicar subastas de artículos o pedir servicios.
          </p>
          <Button
            onClick={async () => {
              const { error } = await supabase.rpc("become_seller");
              if (error) toast.error(errMsg(error));
              else {
                toast.success("¡Ya puedes subastar!");
                qc.invalidateQueries();
              }
            }}
          >
            Activar cuenta de subastador
          </Button>
        </div>
      </PageShell>
    );

  async function addFiles(files: FileList | null) {
    if (!files || !user) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 10 - images.length)) {
        const p = await uploadAuctionImage(user.id, file);
        setImages((x) => [...x, p]);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function create(publish: boolean) {
    if (!user) return;
    setBusy(true);
    try {
      if (type === "item" && (!f.closing_mode || f.starting_price.trim() === ""))
        throw new Error("Elige una modalidad e indica el precio inicial; puede ser cero");
      if (type === "item") {
        const selectedCategory = cats.data?.find((category) => category.id === f.category_id);
        if (!selectedCategory) throw new Error("Elige una categoría y subcategoría para el artículo.");
        if (!selectedCategory.parent_id && cats.data?.some((category) => category.parent_id === selectedCategory.id))
          throw new Error("Elige una subcategoría para continuar.");
        const attributeError = validateItemAttributes(selectedCategory.slug, itemAttributes);
        if (attributeError) throw new Error(attributeError);
      }
      const cur = f.currency || profile.data?.currency || "USD";
      const draftArgs = {
        _data: {
          title: f.title.trim(),
          description: f.description.trim(),
          category_id: f.category_id || null,
          country: f.country || null,
          city: f.city || null,
          scope: f.scope,
          delivery_terms: f.delivery_terms,
          images,
          starting_price: type === "item" ? Number(f.starting_price) : 1,
          min_increment: Number(f.min_increment),
          currency: cur,
          auction_type: type,
          duration_hours:
            type === "item"
              ? f.closing_mode === "fixed"
                ? Number(f.duration_hours)
                : 168
              : Math.max(1, Math.ceil(Number(f.duration_minutes) / 60)),
          duration_minutes: type === "service" ? Number(f.duration_minutes) : null,
          service_from: null,
          service_to: null,
          accepted_payment_methods: methods,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          closing_mode: type === "item" ? f.closing_mode : "fixed",
          quiet_period_minutes: Number(f.quiet_period_minutes),
        },
        _private: {
          reserve_price:
            type === "item" && f.closing_mode !== "flash" && f.reserve ? Number(f.reserve) : null,
          expected_price:
            type === "item" && f.closing_mode !== "flash" && f.expected ? Number(f.expected) : null,
          service_budget: type === "service" && f.starting_price ? Number(f.starting_price) : null,
        },
      };
      const { id: draftId } = await saveDraft({
        data: {
          id: null,
          auction: draftArgs._data,
          private: draftArgs._private,
          delivery: type === "item" ? deliverySchema.parse(delivery) : null,
          request: type === "service" ? request : null,
        },
      });
      if (!draftId) throw new Error("No se pudo guardar el borrador");
      if (type === "item") {
        const selectedCategory = cats.data?.find((category) => category.id === f.category_id);
        if (!selectedCategory) throw new Error("La categoría seleccionada ya no está disponible.");
        const { error: detailsError } = await supabase.from("auction_item_details").upsert({
          auction_id: draftId,
          category_id: selectedCategory.id,
          category_slug: selectedCategory.slug,
          subcategory_name: selectedCategory.name,
          attributes: itemAttributes,
        }, { onConflict: "auction_id" });
        if (detailsError) throw detailsError;
      }
      if (
        publish &&
        type === "service" &&
        request.category === "transport" &&
        !(await checkLocations(draftId))
      ) {
        await qc.invalidateQueries({ queryKey: ["mine"] });
        toast.info("La publicación permanece como borrador hasta validar origen y destino.");
        return;
      }
      if (publish) {
        const { error: e3 } = await supabase.rpc("publish_auction", { _auction_id: draftId });
        if (e3) {
          toast.error(errMsg(e3) + " (guardada como borrador)");
        } else toast.success("¡Subasta publicada!");
      } else toast.success("Borrador guardado");
      setStartsAt("");
      setMethods([]);
      setRequest(emptyServiceRequest());
      setItemAttributes({});
      setDelivery({ mode: "pickup", cost: null, conditions: "" });
      setImages([]);
      setF((p) => ({
        ...p,
        title: "",
        description: "",
        reserve: "",
        expected: "",
        starting_price: "",
        closing_mode: "",
      }));
      qc.invalidateQueries({ queryKey: ["mine"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkLocations(id: string): Promise<boolean> {
    try {
      const result = await verifyServiceLocations({ data: { id } });
      if (result.status === "not_found") {
        toast.error(
          "Google Maps no encontró el origen o el destino. Escribe direcciones más completas.",
        );
        return false;
      }
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    }
  }

  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <PageShell title="Panel del subastador">
      {sub.data === false && (
        <div className="mb-6 rounded-xl border border-nexo-yellow bg-accent p-4 text-sm">
          Necesitas una membresía activa para publicar.{" "}
          <Link to="/planes" className="font-semibold underline">
            Ver membresías
          </Link>
        </div>
      )}
      <div className="grid gap-8">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex gap-2">
            <Button
              variant={type === "item" ? "default" : "outline"}
              onClick={() => setType("item")}
            >
              Subastar artículo
            </Button>
            <Button
              variant={type === "service" ? "default" : "outline"}
              onClick={() => setType("service")}
            >
              Pedir un servicio
            </Button>
          </div>
          {type === "service" && (
            <p className="text-sm text-muted-foreground">
              Describe lo que necesitas; los proveedores ofertan cuánto cobran y tú eliges
              finalmente al proveedor. Ambos necesitan membresía activa.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={f.title} onChange={set("title")} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              value={f.description}
              onChange={set("description")}
              rows={4}
              maxLength={4000}
            />
          </div>
          {type === "service" && <ServiceRequestForm value={request} onChange={setRequest} />}
          {type === "item" ? (
            <ItemCategoryForm
              categories={cats.data ?? []}
              categoryId={f.category_id}
              onCategoryChange={(category_id) => {
                setF((previous) => ({ ...previous, category_id }));
                setItemAttributes({});
              }}
              values={itemAttributes}
              onValuesChange={setItemAttributes}
            />
          ) : (
            <div className="space-y-1.5">
              <Label>Sección del catálogo</Label>
              <select className={sel} value={f.category_id} onChange={set("category_id")}>
                <option value="">Elegir…</option>
                {cats.data?.map((c) => {
                  const parent = c.parent_id ? cats.data?.find((candidate) => candidate.id === c.parent_id) : null;
                  return <option key={c.id} value={c.id}>{parent ? parent.name + " · " + c.name : c.name}</option>;
                })}
              </select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Alcance</Label>
              <select className={sel} value={f.scope} onChange={set("scope")}>
                <option value="local">Local</option>
                <option value="national">Nacional</option>
                <option value="international">Internacional</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>País</Label>
              <CatalogSelect
                kind="country"
                label="País"
                value={f.country}
                onChange={(country) => setF((p) => ({ ...p, country }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={f.city} onChange={set("city")} />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <CatalogSelect
                kind="currency"
                label="Moneda"
                value={f.currency}
                onChange={(currency) => setF((p) => ({ ...p, currency }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {type === "service"
                  ? "Presupuesto máximo (privado y opcional)"
                  : "Precio de salida"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={f.starting_price}
                onChange={set("starting_price")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {type === "service"
                  ? "Reducción mínima entre ofertas"
                  : "Incremento mínimo de puja"}
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={f.min_increment}
                onChange={set("min_increment")}
              />
            </div>
            {(type === "service" || f.closing_mode === "fixed") && (
              <div className="space-y-1.5">
                <Label>Duración desde la primera puja válida</Label>
                {type === "item" ? (
                  <select className={sel} value={f.duration_hours} onChange={set("duration_hours")}>
                    <option value="24">24 horas</option>
                    <option value="48">48 horas</option>
                    <option value="72">72 horas</option>
                    <option value="168">1 semana</option>
                    <option value="360">15 días</option>
                    <option value="720">1 mes</option>
                  </select>
                ) : (
                  <select
                    className={sel}
                    value={f.duration_minutes}
                    onChange={set("duration_minutes")}
                  >
                    {SERVICE_MINUTES.map(([m, l]) => (
                      <option key={m} value={m}>
                        {l}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {type === "item" && (
              <>
                <label className="space-y-1.5 text-sm">
                  Modalidad de cierre
                  <select
                    aria-label="Modalidad de cierre"
                    className={sel}
                    value={f.closing_mode}
                    onChange={(e) =>
                      setF((p) => ({
                        ...p,
                        closing_mode: e.target.value,
                        ...(e.target.value === "flash" ? { reserve: "", expected: "" } : {}),
                      }))
                    }
                  >
                    <option value="">Elegir modalidad…</option>
                    <option value="fixed">Tiempo fijo</option>
                    <option value="reserve">Reserva + prórrogas</option>
                    <option value="flash">Libre / Flash</option>
                  </select>
                </label>
                {(f.closing_mode === "reserve" || f.closing_mode === "flash") && (
                  <label className="space-y-1.5 text-sm">
                    Período sin nuevas pujas (minutos)
                    <select
                      aria-label="Período sin nuevas pujas"
                      className={sel}
                      value={f.quiet_period_minutes}
                      onChange={set("quiet_period_minutes")}
                    >
                      {QUIET_MINUTES.map((m) => (
                        <option key={m} value={m}>
                          {m} minutos
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {f.closing_mode && f.closing_mode !== "flash" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Precio esperado (opcional, privado y orientativo)</Label>
                      <Input type="number" min="0" value={f.expected} onChange={set("expected")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Precio de reserva (opcional y privado)</Label>
                      <Input type="number" min="0" value={f.reserve} onChange={set("reserve")} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {type === "item" && f.closing_mode && (
            <p className="text-sm text-muted-foreground">
              {f.closing_mode === "fixed"
                ? "El tiempo comienza con la primera puja válida y no se amplía. Sin ofertas, finaliza a los 8 días."
                : f.closing_mode === "flash"
                  ? "Sin reserva ni precio esperado. La primera puja válida inicia la prórroga elegida y cada nueva puja la reinicia completa; al vencer sin otra puja, gana la mejor oferta. Sin ofertas, finaliza a los 7 días desde publicación. Sin extensión manual."
                  : "Al alcanzar la reserva, cada puja reinicia la prórroga completa. Sin reserva, comienza con la primera puja. Si la reserva no se alcanza al límite inicial de 7 días, podrás extender una sola vez otros 7 días o finalizar."}
              {f.closing_mode !== "flash" &&
                (f.reserve
                  ? " Solo se adjudica si se alcanza tu reserva privada."
                  : " Sin reserva gana el mejor postor válido.")}
              {f.closing_mode !== "flash" &&
                " El precio esperado es solo orientativo y nunca impide vender."}
            </p>
          )}
          {type === "item" && <DeliveryForm value={delivery} onChange={setDelivery} />}
          {type === "service" && (
            <p className="text-sm text-muted-foreground">
              No incluyas direcciones, contactos ni datos confidenciales en el título o descripción
              pública.
            </p>
          )}
          <AuctionPaymentMethods value={methods} onChange={setMethods} />
          {type === "item" && (
            <div>
              <Label>Fotos desde tu dispositivo</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {images.map((p) => (
                  <div key={p} className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted">
                    {previews.data?.[p] && (
                      <img src={previews.data[p]} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      aria-label="Quitar"
                      className="absolute right-0.5 top-0.5 rounded-full bg-background p-0.5"
                      onClick={() => setImages((x) => x.filter((y) => y !== p))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>
              </div>
            </div>
          )}
          <label className="block space-y-2 text-sm">
            Inicio programado (opcional)
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => create(true)}>
              Publicar ahora
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => create(false)}>
              Guardar borrador
            </Button>
          </div>
        </section>

      </div>
    </PageShell>
  );
}
