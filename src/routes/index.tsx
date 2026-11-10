import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CatalogGallery, catalogSearchSchema, type CatalogSearch } from "@/components/CatalogGallery";
import { InstallCard } from "@/components/InstallCard";

const title = "NEXO — Subastas en línea, destacadas y por categoría";
const description = "Explora subastas activas de productos y servicios por categoría, país y precio en NEXO. Inicia sesión solo para pujar o publicar.";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  validateSearch: catalogSearchSchema,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nexosubastas.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://nexosubastas.com/" }],
  }),
  component: Index,
});

function Index() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  return (
    <>
      <CatalogGallery
        s={s}
        title="Subastas en NEXO"
        set={(patch: Partial<CatalogSearch>) => navigate({ search: (prev) => ({ ...prev, page: 0, ...patch }), replace: true })}
      />
      <div className="mx-auto max-w-6xl px-4 pb-10"><InstallCard /></div>
    </>
  );
}
