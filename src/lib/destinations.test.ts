import { describe, expect, it } from "vitest";
import { authDestination, safeDestination } from "./destinations";

describe("destinos internos NEXO", () => {
  it("conserva el destino de membresía con su solicitud", () =>
    expect(safeDestination("/planes?request=123")).toBe("/planes?request=123"));
  it("conserva el detalle exacto de la subasta", () =>
    expect(safeDestination("/subastas/00000000-0000-0000-0000-000000000001")).toBe(
      "/subastas/00000000-0000-0000-0000-000000000001",
    ));
  it("rechaza destinos externos y barras invertidas", () => {
    for (const path of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/%5cevil.example",
      "/%2fevil.example",
    ])
      expect(safeDestination(path)).toBeNull();
  });
  it("rechaza páginas inexistentes y enlaces de API", () => {
    expect(safeDestination("/api/public/action")).toBeNull();
    expect(safeDestination("/missing")).toBeNull();
  });
  it("no propaga credenciales OAuth", () => {
    expect(safeDestination("/perfil#access_token=secret")).toBe("/perfil");
    expect(safeDestination("/perfil?access_token=secret")).toBeNull();
  });
  it("usa una alternativa segura para enlaces inválidos", () =>
    expect(authDestination("//evil.example")).toBe("/subastas"));
});
