import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CatalogGallery, catalogSearchSchema, type CatalogSearch } from "@/components/CatalogGallery";
export const Route = createFileRoute("/subastas/")({
  staticData: { sitemap: true },
  validateSearch: catalogSearchSchema,
  head: () => ({
    meta: [
      { title: "Catálogo de subastas — NEXO" },
      {
        name: "description",
        content: "Explora subastas activas por categoría, ubicación y precio en NEXO.",
      },
      { property: "og:title", content: "Catálogo de subastas — NEXO" },
      { property: "og:description", content: "Subastas activas, programadas y finalizadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/subastas/" });
  return <CatalogGallery s={s} set={(patch: Partial<CatalogSearch>) => navigate({ search: (prev) => ({ ...prev, page: 0, ...patch }), replace: true })} />;
}
