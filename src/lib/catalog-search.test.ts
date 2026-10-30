import { describe, expect, it } from "vitest";
import { searchCatalog, currencySymbol } from "./catalog-search";
import { COUNTRIES, CURRENCIES } from "./currency";
describe("búsqueda ISO completa", () => {
  const countries = COUNTRIES.map(([code, label]) => ({ code, label, value: code }));
  const currencies = CURRENCIES.map(([code, label]) => ({ code, label, value: code, symbol: currencySymbol(code) }));
  it("mantiene 249 países y encuentra nombre/código sin acentos", () => { expect(searchCatalog(countries, "")).toHaveLength(249); expect(searchCatalog(countries, "NI").some((option) => option.code === "NI")).toBe(true); expect(searchCatalog(countries, "mexico").some((option) => option.code === "MX")).toBe(true); });
  it("busca NIO por código, córdoba por nombre y dólar por símbolo", () => { expect(searchCatalog(currencies, "NIO").map((option) => option.code)).toContain("NIO"); expect(searchCatalog(currencies, "cordoba").map((option) => option.code)).toContain("NIO"); expect(searchCatalog(currencies, "$" ).map((option) => option.code)).toContain("USD"); expect(searchCatalog(currencies, "")).toHaveLength(CURRENCIES.length); });
});