import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/SiteLayout";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad — NEXO" },
      { name: "description", content: "Qué datos recopila NEXO, cómo los usa y cómo los protege." },
      { property: "og:title", content: "Privacidad — NEXO" },
      { property: "og:description", content: "Cómo NEXO trata tus datos personales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Política de privacidad">
      <h2>Datos que recopilamos</h2>
      <p>Datos de cuenta (nombre, correo), publicaciones, ofertas y mensajes necesarios para operar la plataforma.</p>
      <h2>Uso</h2>
      <p>Solo para prestar el servicio, prevenir fraudes y cumplir obligaciones legales. No vendemos tus datos.</p>
      <h2>Datos confidenciales</h2>
      <p>Los precios de reserva y esperados de los vendedores nunca se comparten con otros usuarios.</p>
      <h2>Tus derechos</h2>
      <p>Puedes solicitar acceso, corrección o eliminación de tus datos.</p>
    </LegalPage>
  ),
});
