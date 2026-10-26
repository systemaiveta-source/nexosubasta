import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Empty } from "@/components/SiteLayout";

export const Route = createFileRoute("/planes")({
  head: () => ({
    meta: [
      { title: "Planes — NEXO" },
      { name: "description", content: "Planes en NEXO." },
      { property: "og:title", content: "Planes — NEXO" },
      { property: "og:description", content: "Planes en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Planes">
      <Empty>Sección en construcción: disponible en la próxima fase.</Empty>
    </PageShell>
  ),
});
