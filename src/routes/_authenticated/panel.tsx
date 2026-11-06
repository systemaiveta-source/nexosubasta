import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PageShell, Empty } from "@/components/SiteLayout";
import { listMyBids } from "@/lib/bids.functions";
import { money, statusLabel } from "@/lib/format";
const options = queryOptions({
  queryKey: ["my-bids"],
  queryFn: () => listMyBids(),
  refetchInterval: 15000,
});
export const Route = createFileRoute("/_authenticated/panel")({
  staticData: { sitemap: false },
  loader: ({ context }) => context.queryClient.ensureQueryData(options),
  head: () => ({
    meta: [
      { title: "Mis ofertas y resultados — NEXO" },
      { name: "description", content: "Historial privado de tus pujas y ofertas de servicios." },
      { property: "og:title", content: "Mis ofertas y resultados — NEXO" },
      { property: "og:description", content: "Consulta el estado de tus ofertas en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Panel,
});
function Panel() {
  const { data } = useSuspenseQuery(options);
  return (
    <PageShell title="Mis ofertas">
      {data.length ? (
        <ul className="divide-y divide-border">
          {data.map((b) => (
            <li key={b.id} className="flex flex-wrap justify-between gap-3 py-4">
              <div>
                <Link
                  to="/subastas/$id"
                  params={{ id: b.auction_id }}
                  className="font-semibold underline"
                >
                  {b.auction?.title ?? "Subasta no disponible"}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {b.auction?.status ? statusLabel[b.auction.status] : ""} ·{" "}
                  {new Date(b.created_at).toLocaleString("es")}
                  {b.isLeader ? " · Oferta líder" : ""}
                </p>
                {b.conditions && (
                  <p className="whitespace-pre-wrap break-words text-sm">{b.conditions}</p>
                )}
              </div>
              <p className="font-semibold">{money(b.amount, b.auction?.currency ?? "USD")}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Aún no has enviado ofertas.{" "}
          <Link to="/subastas" className="underline">
            Explorar subastas
          </Link>
        </Empty>
      )}
    </PageShell>
  );
}
