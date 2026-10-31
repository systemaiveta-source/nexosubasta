import { NEXO_ORIGIN, publicImageUrl } from "./site-url";
export { NEXO_ORIGIN } from "./site-url";
export function auctionShareUrl(id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
    throw new Error("Subasta no válida");
  return `${NEXO_ORIGIN}/subastas/${id}`;
}
export function auctionShareHead(
  id: string,
  auction: { title: string; description: string; image: boolean } | null,
) {
  const url = auctionShareUrl(id);
  const title = auction ? `${auction.title} — NEXO` : "Subasta no disponible — NEXO";
  const description = auction?.description || "Consulta esta subasta en NEXO.";
  const image = publicImageUrl(id);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:card", content: auction?.image ? "summary_large_image" : "summary" },
      ...(auction?.image
        ? [
            { property: "og:image", content: image },
            { name: "twitter:image", content: image },
            { property: "og:image:alt", content: auction.title },
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
export function socialShareLinks(id: string, title: string) {
  const url = auctionShareUrl(id);
  return {
    WhatsApp: `https://wa.me/?${new URLSearchParams({ text: `${title}\n${url}` })}`,
    Facebook: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
    X: `https://twitter.com/intent/tweet?${new URLSearchParams({ text: title, url })}`,
    Telegram: `https://t.me/share/url?${new URLSearchParams({ url, text: title })}`,
  };
}
