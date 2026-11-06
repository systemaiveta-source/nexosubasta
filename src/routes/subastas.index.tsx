import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, Empty } from "@/components/SiteLayout";
import {
  AuctionCard,
  AUCTION_LIST_COLUMNS,
  useNow,
  type AuctionListItem,
} from "@/components/AuctionCard";
import { useImageUrls } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { CatalogSelect } from "@/components/CatalogSelect";
import { Input } from "@/components/ui/input";

const search = z.object({
  page: z.number().int().min(0).optional(),
  tipo: z.enum(["item", "service"]).optional(),
  q: z.string().optional(),
  cat: z.string().optional(),
  scope: z.enum(["local", "national", "international"]).optional(),
  estado: z.enum(["active", "scheduled", "ended"]).optional(),
  orden: z.enum(["ending", "new", "price_asc", "price_desc"]).optional(),
  pais: z.string().optional(),
});

export const Route = createFileRoute("/subastas/")({
  staticData: { sitemap: true },
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Catálogo de subastas — NEXO" },
      {
        name: "description",
        content: "Explora subastas activas por categoría, ubicación y precio en NEXO.",
      },
      { property: "og:title", content: "Catálogo de subastas — NEXO" },
      { property: "og:description", content: "Subastas activas, programadas y finalizadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/subastas/" });
  const now = useNow();
  const set = (patch: Partial<typeof s>) =>
    navigate({ search: (prev) => ({ ...prev, page: 0, ...patch }), replace: true });

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (
        await supabase
          .from("categories")
          .select("id,name,slug")
          .neq("slug", "nft-cripto")
          .order("sort")
      ).data ?? [],
  });

  const list = useQuery({
    queryKey: ["catalog", s],
    queryFn: async () => {
      const featured = await supabase.rpc("featured_auction_ids");
      if (featured.error) throw featured.error;
      const featuredIds = new Set(featured.data ?? []);
      let q = supabase
        .from("auctions_safe")
        .select(AUCTION_LIST_COLUMNS)
        .neq("status", "draft")
        .neq("status", "cancelled");
      if (s.tipo) q = q.eq("auction_type", s.tipo);
      const estado = s.estado ?? "active";
      if (estado === "ended") q = q.in("status", ["ended_sold", "ended_unsold"]);
      else q = q.eq("status", estado);
      if (s.q) q = q.ilike("title", `%${s.q.replace(/[%_]/g, "")}%`);
      if (s.cat) q = q.eq("category_id", s.cat);
      if (s.scope) q = q.eq("scope", s.scope);
      if (s.pais) q = q.ilike("country", `%${s.pais.replace(/[%_]/g, "")}%`);
      const orden = s.orden ?? "ending";
      if (orden === "ending") q = q.order("ends_at", { ascending: estado !== "ended" });
      if (orden === "new") q = q.order("created_at", { ascending: false });
      if (orden === "price_asc")
        q = q.order("current_price", { ascending: true, nullsFirst: true });
      if (orden === "price_desc")
        q = q.order("current_price", { ascending: false, nullsFirst: false });
      const { data, error } = await q.range((s.page ?? 0) * 24, (s.page ?? 0) * 24 + 23);
      if (error) throw error;
      const items = (data as unknown as AuctionListItem[]).map(a => ({...a, featured: featuredIds.has(a.id)}));
      return items.sort((a,b) => Number(b.featured) - Number(a.featured));
    },
  });
  const imgs = useImageUrls(list.data?.map((a) => a.images[0]).filter((x): x is string => !!x));

  const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <PageShell title="Subastas">
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <form
          className="relative sm:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: (new FormData(e.currentTarget).get("q") as string) || undefined });
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={s.q} placeholder="Buscar artículos…" className="pl-9" />
        </form>
        <select
          className={sel}
          value={s.cat ?? ""}
          onChange={(e) => set({ cat: e.target.value || undefined })}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={s.scope ?? ""}
          onChange={(e) => set({ scope: (e.target.value || undefined) as typeof s.scope })}
          aria-label="Alcance"
        >
          <option value="">Cualquier alcance</option>
          <option value="local">Local</option>
          <option value="national">Nacional</option>
          <option value="international">Internacional</option>
        </select>
        <select
          className={sel}
          value={s.estado ?? "active"}
          onChange={(e) => set({ estado: e.target.value as typeof s.estado })}
          aria-label="Estado"
        >
          <option value="active">Activas</option>
          <option value="scheduled">Próximas</option>
          <option value="ended">Finalizadas</option>
        </select>
        <select
          className={sel}
          value={s.orden ?? "ending"}
          onChange={(e) => set({ orden: e.target.value as typeof s.orden })}
          aria-label="Orden"
        >
          <option value="ending">Terminan antes</option>
          <option value="new">Más recientes</option>
          <option value="price_asc">Precio: menor</option>
          <option value="price_desc">Precio: mayor</option>
        </select>
        <CatalogSelect
          kind="country"
          label="País"
          value={s.pais ?? ""}
          onChange={(pais) => set({ pais: pais || undefined })}
          empty="Todos los países"
        />
        <select
          aria-label="Tipo de subasta"
          className={sel}
          value={s.tipo ?? ""}
          onChange={(e) => set({ tipo: (e.target.value || undefined) as typeof s.tipo })}
        >
          <option value="">Productos y servicios</option>
          <option value="item">Productos</option>
          <option value="service">Servicios</option>
        </select>
      </div>
      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : list.error ? (
        <Empty>No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.</Empty>
      ) : list.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.data.map((a) => (
            <AuctionCard
              key={a.id}
              a={a}
              img={a.images[0] ? imgs.data?.[a.images[0]] : undefined}
              now={now}
            />
          ))}
        </div>
      ) : (
        <Empty>No hay subastas que coincidan con tu búsqueda.</Empty>
      )}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          disabled={!s.page}
          onClick={() => set({ page: (s.page ?? 0) - 1 })}
        >
          Anterior
        </Button>
        <span className="text-sm">Página {(s.page ?? 0) + 1}</span>
        <Button
          variant="outline"
          disabled={(list.data?.length ?? 0) < 24}
          onClick={() => set({ page: (s.page ?? 0) + 1 })}
        >
          Siguiente
        </Button>
      </div>
    </PageShell>
  );
}
