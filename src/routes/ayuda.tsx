import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/SiteLayout";

export const Route = createFileRoute("/ayuda")({
  head: () => ({
    meta: [
      { title: "Ayuda — NEXO" },
      { name: "description", content: "Cómo funcionan las subastas en NEXO: ofertas, reserva, extensión de cierre y trato entre comprador y vendedor." },
      { property: "og:title", content: "Ayuda — NEXO" },
      { property: "og:description", content: "Preguntas frecuentes sobre las subastas de NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Ayuda">
      <h2>¿Cómo funciona una subasta?</h2>
      <p>El vendedor fija un precio inicial público. Los compradores ofertan por encima del incremento mínimo. Gana la oferta válida más alta al cierre, si alcanza la reserva.</p>
      <h2>¿Qué es el precio de reserva?</h2>
      <p>Es un mínimo privado del vendedor. Nunca se muestra su importe: solo verás «Precio de reserva alcanzado» o «aún no alcanzado».</p>
      <h2>¿Por qué se amplió el cierre?</h2>
      <p>Si llega una oferta válida en los últimos 60 segundos, el cierre se amplía exactamente 60 segundos. Así todos tienen oportunidad de responder.</p>
      <h2>¿Cómo se paga?</h2>
      <p>En esta primera versión, comprador y vendedor acuerdan directamente el pago y la entrega. NEXO no retiene el dinero.</p>
    </LegalPage>
  ),
});
