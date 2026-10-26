import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Empty } from "@/components/SiteLayout";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Mis ofertas — NEXO" },
      { name: "description", content: "Mis ofertas en NEXO." },
      { property: "og:title", content: "Mis ofertas — NEXO" },
      { property: "og:description", content: "Mis ofertas en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Mis ofertas">
      <Empty>Sección en construcción: disponible en la próxima fase.</Empty>
    </PageShell>
  ),
});
