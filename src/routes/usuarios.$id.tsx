import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { PageShell, Empty } from "@/components/SiteLayout";
import { getPublicProfile } from "@/lib/profiles.functions";
import { supabase } from "@/integrations/supabase/client";
import { AuctionCard, AUCTION_LIST_COLUMNS, useNow, type AuctionListItem } from "@/components/AuctionCard";
import { useImageUrls } from "@/lib/images";
const profileOptions = (id: string) => queryOptions({queryKey: ["public-profile", id], queryFn: () => getPublicProfile({data: {id}})});

export const Route = createFileRoute("/usuarios/$id")({
  staticData: { sitemap: false },
  loader: ({context, params}) => context.queryClient.ensureQueryData(profileOptions(params.id)),
  head: ({loaderData}) => ({
    meta: [
      { title: `${loaderData?.display_name ?? "Perfil de usuario"} — NEXO` },
      { name: "description", content: "Perfil de usuario en NEXO." },
      { property: "og:title", content: `${loaderData?.display_name ?? "Perfil de usuario"} — NEXO` },
      { property: "og:description", content: "Perfil de usuario en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const {id} = Route.useParams();
  const {data: profile} = useSuspenseQuery(profileOptions(id));
  const now = useNow();
  const list = useQuery({queryKey: ["profile-publications", id], queryFn: async () => {
    const {data, error} = await supabase.from("auctions_safe").select(AUCTION_LIST_COLUMNS)
      .eq("seller_id", id).not("status", "in", "(draft,cancelled)").order("created_at", {ascending: false});
    if (error) throw error;
    return data as unknown as AuctionListItem[];
  }});
  const imgs = useImageUrls(list.data?.flatMap(a => a.images.slice(0, 1)));
  if (!profile) return <PageShell title="Perfil no disponible"><Empty>Este perfil no está disponible.</Empty></PageShell>;
  return <PageShell title={profile.display_name}>
    <section className="mb-8 space-y-3 border-b border-border pb-6">
      {profile.membership.badge && <span className="inline-block rounded-md bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">{profile.membership.badge}</span>}
      <p className="text-muted-foreground">{[profile.city, profile.country].filter(Boolean).join(", ")}</p>
      {profile.bio && <p className="whitespace-pre-wrap break-words">{profile.bio}</p>}
      <p className="text-sm">Miembro desde {new Date(profile.created_at).toLocaleDateString("es")} · {profile.rating?.toFixed(1) ?? "Sin valoraciones"}{profile.rating !== null ? " / 5" : ""} · {profile.review_count} valoraciones</p>
    </section>
    <h2 className="mb-4 font-display text-xl font-bold">Publicaciones</h2>
    {list.isPending ? <p>Cargando publicaciones…</p> : list.error ? <Empty>No se pudieron cargar las publicaciones.</Empty> : list.data?.length ?
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{list.data.map(a => <AuctionCard key={a.id} a={a} now={now} img={imgs.data?.[a.images[0] ?? ""]}/>)}</div> : <Empty>Sin publicaciones públicas.</Empty>}
    <section className="mt-8 space-y-4 border-t border-border pt-6">
      <h2 className="font-display text-xl font-bold">Reputación</h2>
      {profile.reviews.map((r,i) => <div key={i} className="border-b border-border pb-3"><p className="text-sm font-semibold">{r.rating} / 5 · {new Date(r.created_at).toLocaleDateString("es")}</p><p className="whitespace-pre-wrap break-words text-sm">{r.comment}</p></div>)}
      {!profile.reviews.length && <p className="text-muted-foreground">Todavía no hay valoraciones.</p>}
      <Link to="/subastas" className="text-sm underline">Ver todas las subastas</Link>
    </section>
  </PageShell>;
}
