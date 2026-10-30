export type CatalogOption = { value: string; label: string; code: string; symbol?: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
export function searchCatalog(options: readonly CatalogOption[], query: string) {
  const key = normalize(query.trim());
  return options.filter((option) => normalize(`${option.label} ${option.code} ${option.symbol ?? ""}`).includes(key));
}
export function currencySymbol(code: string) {
  try { return new Intl.NumberFormat("es", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code; }
  catch { return code; }
}