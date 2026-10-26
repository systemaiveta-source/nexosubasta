import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/SiteLayout";

export const Route = createFileRoute("/normas")({
  head: () => ({
    meta: [
      { title: "Normas de la comunidad — NEXO" },
      { name: "description", content: "Reglas para compradores y vendedores en NEXO: artículos permitidos, ofertas y conducta." },
      { property: "og:title", content: "Normas — NEXO" },
      { property: "og:description", content: "Reglas de uso para compradores y vendedores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Normas de la comunidad">
      <ul>
        <li>Publica solo artículos y servicios legales que te pertenezcan.</li>
        <li>Describe con honestidad el estado del artículo y las condiciones de entrega.</li>
        <li>Cada oferta es un compromiso de compra si resulta ganadora.</li>
        <li>Prohibidas las ofertas falsas, las cuentas duplicadas y la manipulación de precios.</li>
        <li>Trata a los demás con respeto en los mensajes privados.</li>
      </ul>
    </LegalPage>
  ),
});
