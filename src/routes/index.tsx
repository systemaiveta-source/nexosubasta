import { createFileRoute, Link } from "@tanstack/react-router";
import { Gavel, ShieldCheck, Timer, Smartphone } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import logo from "@/assets/nexo-logo.png.asset.json";
import { useInstall } from "@/lib/install";
import { Button } from "@/components/ui/button";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPublicSocialLinks } from "@/lib/social-links.functions";
import { SocialLinks } from "@/components/SocialLinks";

const socialQuery = queryOptions({
  queryKey: ["public-social-links"],
  queryFn: () => listPublicSocialLinks(),
  staleTime: 60000,
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(socialQuery),
  head: () => ({
    meta: [
      { title: "NEXO — Sistema de subastas" },
      {
        name: "description",
        content:
          "Participa y subasta en subastas transparentes, locales e internacionales, con reglas claras y precios de reserva protegidos.",
      },
      { property: "og:title", content: "NEXO — Sistema de subastas" },
      {
        property: "og:description",
        content: "Subastas transparentes con reglas claras y precios de reserva protegidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Gavel,
    color: "text-nexo-red",
    title: "Ofertas validadas",
    text: "Cada oferta se verifica en el servidor; nunca se acepta una oferta duplicada ni fuera de tiempo.",
  },
  {
    icon: Timer,
    color: "text-nexo-blue",
    title: "Cierre justo",
    text: "Una oferta en el último minuto amplía el cierre 60 segundos, para que nadie gane por sorpresa.",
  },
  {
    icon: ShieldCheck,
    color: "text-nexo-yellow",
    title: "Reserva protegida",
    text: "El precio mínimo del vendedor es privado. Solo se muestra si se ha alcanzado o no.",
  },
  {
    icon: Smartphone,
    color: "text-nexo-green",
    title: "En cualquier dispositivo",
    text: "Úsalo en el navegador o instálalo como app en tu móvil o computadora.",
  },
];

function Index() {
  const installation = useInstall();
  const { data: socialLinks } = useSuspenseQuery(socialQuery);
  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 text-center sm:pt-20">
        <img src={logo.url} alt="NEXO" className="mx-auto h-20 w-auto sm:h-28" />
        <h1 className="mx-auto mt-8 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-5xl">
          NEXO · Subastas
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground sm:text-lg">
          Locales, nacionales e internacionales. Reglas transparentes, un solo ganador y trato
          directo entre participante y subastador.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/subastas"
            className="inline-flex items-center rounded-md border border-border bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Explorar subastas
          </Link>
          {installation.available && <Button onClick={installation.install}>Instalar NEXO</Button>}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <f.icon className={`h-7 w-7 ${f.color}`} />
            <h2 className="mt-4 font-display text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
      <SocialLinks links={socialLinks} />
    </SiteLayout>
  );
}
