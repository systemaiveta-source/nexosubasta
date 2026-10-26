import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Empty } from "@/components/SiteLayout";

export const Route = createFileRoute("/_authenticated/vendedor")({
  head: () => ({
    meta: [
      { title: "Panel del vendedor — NEXO" },
      { name: "description", content: "Panel del vendedor en NEXO." },
      { property: "og:title", content: "Panel del vendedor — NEXO" },
      { property: "og:description", content: "Panel del vendedor en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Panel del vendedor">
      <Empty>Sección en construcción: disponible en la próxima fase.</Empty>
    </PageShell>
  ),
});
