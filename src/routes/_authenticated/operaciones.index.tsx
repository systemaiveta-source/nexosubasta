import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PageShell, Empty } from "@/components/SiteLayout";
import { listOperations } from "@/lib/operations.functions";
import { money, txStatusLabel } from "@/lib/format";
const options = queryOptions({ queryKey: ["operations"], queryFn: () => listOperations() });
export const Route = createFileRoute("/_authenticated/operaciones/")({
  staticData: { sitemap: false },
  loader: ({ context }) => context.queryClient.ensureQueryData(options),
  head: () => ({
    meta: [
      { title: "Operaciones privadas — NEXO" },
      { name: "description", content: "Acuerdos, mensajes y finalización de tus subastas." },
      { property: "og:title", content: "Operaciones privadas — NEXO" },
      { property: "og:description", content: "Coordina tus acuerdos en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Operations,
});
function Operations() {
  const { data } = useSuspenseQuery(options);
  return (
    <PageShell title="Operaciones">
      {data.length ? (
        <ul className="divide-y divide-border">
          {data.map((t) => (
            <li key={t.id}>
              <Link
                to="/operaciones/$id"
                params={{ id: t.id }}
                className="flex flex-wrap items-center justify-between gap-3 py-5"
              >
                <div>
                  <p className="font-semibold">Operación {t.id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    {txStatusLabel[t.status]}
                  </p>
                </div>
                <span className="font-semibold">{money(t.amount, t.currency)} →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aún no tienes operaciones adjudicadas.</Empty>
      )}
    </PageShell>
  );
}
