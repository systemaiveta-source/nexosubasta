import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Empty } from "@/components/SiteLayout";

export const Route = createFileRoute("/usuarios/$id")({
  head: () => ({
    meta: [
      { title: "Perfil de usuario — NEXO" },
      { name: "description", content: "Perfil de usuario en NEXO." },
      { property: "og:title", content: "Perfil de usuario — NEXO" },
      { property: "og:description", content: "Perfil de usuario en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Perfil de usuario">
      <Empty>Sección en construcción: disponible en la próxima fase.</Empty>
    </PageShell>
  ),
});
