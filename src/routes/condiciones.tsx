import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/SiteLayout";

export const Route = createFileRoute("/condiciones")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Condiciones de uso — NEXO" },
      { name: "description", content: "Términos que regulan el uso de la plataforma de subastas NEXO." },
      { property: "og:title", content: "Condiciones de uso — NEXO" },
      { property: "og:description", content: "Términos de uso de NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Condiciones de uso">
      <h2>El servicio</h2>
      <p>NEXO conecta a compradores y vendedores mediante subastas. NEXO no es parte de la compraventa ni retiene pagos en esta versión.</p>
      <h2>Cuentas</h2>
      <p>Eres responsable de la seguridad de tu cuenta y de la veracidad de tus datos.</p>
      <h2>Subastas</h2>
      <p>La hora oficial del servidor determina la validez de las ofertas y el cierre. Las decisiones del motor de subastas son definitivas salvo error técnico verificado.</p>
      <h2>Suscripciones</h2>
      <p>Publicar requiere una suscripción de vendedor activa. Los planes y precios se anunciarán antes de activarse.</p>
    </LegalPage>
  ),
});
