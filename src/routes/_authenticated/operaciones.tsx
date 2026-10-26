import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Empty } from "@/components/SiteLayout";

export const Route = createFileRoute("/_authenticated/operaciones")({
  head: () => ({
    meta: [
      { title: "Operaciones — NEXO" },
      { name: "description", content: "Operaciones en NEXO." },
      { property: "og:title", content: "Operaciones — NEXO" },
      { property: "og:description", content: "Operaciones en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Operaciones">
      <Empty>Sección en construcción: disponible en la próxima fase.</Empty>
    </PageShell>
  ),
});
