import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Empty } from "@/components/SiteLayout";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — NEXO" },
      { name: "description", content: "Mi perfil en NEXO." },
      { property: "og:title", content: "Mi perfil — NEXO" },
      { property: "og:description", content: "Mi perfil en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Mi perfil">
      <Empty>Sección en construcción: disponible en la próxima fase.</Empty>
    </PageShell>
  ),
});
