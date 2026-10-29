/** Only known in-app destinations; never accept external URLs or auth callback fragments. */
export function safeDestination(value: string | null | undefined): string | null {
  if (
    !value ||
    value !== value.trim() ||
    /[\\\u0000-\u0020\u007f]/.test(value) ||
    /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  )
    return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://nexo.invalid");
    if (url.origin !== "https://nexo.invalid" || url.pathname.includes("..")) return null;
    const known =
      /^\/(?:subastas(?:\/[a-f0-9-]{36})?|panel|vendedor|operaciones|perfil|planes|notificaciones|admin|ayuda|normas|condiciones|privacidad|instalar|usuarios\/[a-f0-9-]{36})?\/?$/i;
    if (!known.test(url.pathname)) return null;
    // Keep only a non-secret query; hashes may contain OAuth tokens, so never forward them.
    if (/[?&](?:access_token|refresh_token|token|code)=/i.test(url.search)) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

export function authDestination(value: string | null | undefined) {
  return safeDestination(value) ?? "/subastas";
}
