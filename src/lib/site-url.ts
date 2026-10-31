/** Official custom domain already configured for NEXO; never inferred from request headers. */
export const NEXO_ORIGIN = "https://nexosubastas.com";
export function publicImageUrl(id: string) {
  return `${NEXO_ORIGIN}/api/public/subastas/${id}/miniatura`;
}