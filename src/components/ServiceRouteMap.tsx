/** Rendered only after authenticated service-details access; never geocodes in the browser. */
export function ServiceRouteMap({
  origin,
  destination,
  verified,
}: {
  origin: string;
  destination: string;
  verified: boolean;
}) {
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
  if (!key || !verified)
    return (
      <p className="text-sm text-muted-foreground">
        Ruta pendiente de validación con Google Maps. No se admiten ofertas de transporte sin ambas
        ubicaciones verificadas.
      </p>
    );
  const query = new URLSearchParams({
    key,
    origin,
    destination,
    mode: "driving",
    language: "es",
    ...(channel ? { channel } : {}),
  });
  return (
    <iframe
      title="Ruta de recogida y entrega"
      className="h-80 w-full rounded-md border border-border"
      loading="lazy"
      referrerPolicy="no-referrer"
      allowFullScreen
      src={`https://www.google.com/maps/embed/v1/directions?${query}`}
    />
  );
}
