import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { CATALOG_BATCH_SIZE, uniqueAuctions, nextCatalogOffset } from "@/lib/catalog-feed";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
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

export const catalogSearchSchema = z.object({
  page: z.number().int().min(0).optional(),
  tipo: z.enum(["item", "service"]).optional(),
  q: z.string().optional(),
  cat: z.string().optional(),
  scope: z.enum(["local", "national", "international"]).optional(),
  estado: z.enum(["active", "scheduled", "ended"]).optional(),
  orden: z.enum(["ending", "new", "price_asc", "price_desc"]).optional(),
  pais: z.string().optional(),
});

export type CatalogSearch = z.infer<typeof catalogSearchSchema>;

export function CatalogGallery({ s, set, title = "Subastas" }: { s: CatalogSearch; set: (patch: Partial<CatalogSearch>) => void; title?: string }) {
  const now = useNow();

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

  const { page: _page, ...filters } = s;
  const list = useInfiniteQuery({
    queryKey: ["catalog-feed", filters],
    initialPageParam: 0,
    getNextPageParam: nextCatalogOffset,
    queryFn: async ({ pageParam, signal }) => {
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
      if (s.cat) {
        const childIds = (cats.data ?? []).filter((item) => item.parent_id === s.cat).map((item) => item.id);
        q = q.in("category_id", [s.cat, ...childIds]);
      }
      if (s.scope) q = q.eq("scope", s.scope);
      if (s.pais) q = q.ilike("country", `%${s.pais.replace(/[%_]/g, "")}%`);
      const orden = s.orden ?? "ending";
      if (orden === "ending") q = q.order("ends_at", { ascending: estado !== "ended" });
      if (orden === "new") q = q.order("created_at", { ascending: false });
      if (orden === "price_asc")
        q = q.order("current_price", { ascending: true, nullsFirst: true });
      if (orden === "price_desc")
        q = q.order("current_price", { ascending: false, nullsFirst: false });
      const { data, error } = await q.order("id").range(pageParam, pageParam + CATALOG_BATCH_SIZE - 1).abortSignal(signal);
      if (error) throw error;
      const items = (data as unknown as AuctionListItem[]).map(a => ({...a, featured: featuredIds.has(a.id)}));
      return { items, offset: pageParam };
    },
  });
  const items = uniqueAuctions(list.data?.pages.map(p => p.items) ?? []);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = endRef.current;
    if (!element || !list.hasNextPage || list.isFetchNextPageError) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !list.isFetching) void list.fetchNextPage();
    }, {rootMargin: "600px"});
    observer.observe(element);
    return () => observer.disconnect();
  }, [list.hasNextPage, list.isFetching, list.isFetchNextPageError, list.fetchNextPage, items.length]);
  const imgs = useImageUrls(items.map((a) => a.images[0]).filter((x): x is string => !!x));
  const promoted = useQuery({queryKey:["featured-auctions"],refetchInterval:60000,queryFn:async()=>{
    const ids=await supabase.rpc("featured_auction_ids");
    if(ids.error) throw ids.error;
    if(!ids.data?.length) return [];
    const result=await supabase.from("auctions_safe").select(AUCTION_LIST_COLUMNS).in("id",ids.data).eq("status","active").order("created_at",{ascending:false});
    if(result.error) throw result.error;
    return (result.data as unknown as AuctionListItem[]).map(a=>({...a,featured:true}));
  }});
  const promotedImages=useImageUrls(promoted.data?.flatMap(a=>a.images.slice(0,1)));

  const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (dir: 1 | -1) =>
    carouselRef.current?.scrollBy({ left: dir * 560, behavior: "smooth" });

  return (
    <PageShell title={title}>
      {!s.q && !s.cat && !s.tipo && !s.pais && (!s.estado || s.estado==="active") && !!promoted.data?.length && <section className="mb-8 border-b border-border pb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Destacadas</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Destacadas anteriores" onClick={() => scrollCarousel(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Destacadas siguientes" onClick={() => scrollCarousel(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div ref={carouselRef} className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{promoted.data.map(a=><div key={a.id} className="w-64 shrink-0"><AuctionCard a={a} now={now} img={promotedImages.data?.[a.images[0]??""]}/></div>)}</div>
      </section>}
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
          {cats.data?.map((c) => {
            const parent = c.parent_id ? cats.data?.find((item) => item.id === c.parent_id) : null;
            return <option key={c.id} value={c.id}>{parent ? parent.name + " · " + c.name : c.name}</option>;
          })}
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
      ) : list.error && !items.length ? (
        <Empty>No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.</Empty>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((a) => (
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
      <div ref={endRef} className="mt-6 min-h-12 text-center text-sm text-muted-foreground" aria-live="polite">
        {list.isFetchingNextPage ? "Cargando más subastas…" : list.error ? <Button variant="outline" onClick={() => list.isFetchNextPageError ? list.fetchNextPage() : list.refetch()}>Reintentar</Button> : items.length > 0 && !list.hasNextPage ? "Has llegado al final" : null}
      </div>
    </PageShell>
  );
}
