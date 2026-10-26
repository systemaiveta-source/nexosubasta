import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Empty } from "@/components/SiteLayout";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración — NEXO" },
      { name: "description", content: "Administración en NEXO." },
      { property: "og:title", content: "Administración — NEXO" },
      { property: "og:description", content: "Administración en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Administración">
      <Empty>Sección en construcción: disponible en la próxima fase.</Empty>
    </PageShell>
  ),
});
