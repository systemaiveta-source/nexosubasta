import { describe, expect, it } from "vitest";
import { COUNTRIES, CURRENCIES } from "./currency";
describe("catálogos ISO", () => {
  it("incluye países y territorios ISO 3166-1 sin exigir búsqueda", () => {
    expect(COUNTRIES.length).toBe(249);
    expect(COUNTRIES.some(([c]) => c === "NI")).toBe(true);
  });
  it("conserva moneda original NIO y USD sin conversión", () => {
    expect(CURRENCIES.some(([c]) => c === "NIO")).toBe(true);
    expect(CURRENCIES.some(([c]) => c === "USD")).toBe(true);
  });
});
