import { describe, expect, it } from "vitest";
import { auctionMethodSchema, parseAuctionMethods } from "./auction-payments";
describe("condiciones de pago de subastas", () => {
  it("Otro requiere nombre", () =>
    expect(auctionMethodSchema.safeParse({ name: "", kind: "other" }).success).toBe(false));
  it("cripto requiere activo y red", () => {
    expect(
      auctionMethodSchema.safeParse({ name: "Cripto", kind: "crypto", asset: "USDT" }).success,
    ).toBe(false);
    expect(
      auctionMethodSchema.safeParse({
        name: "Cripto",
        kind: "crypto",
        asset: "USDT",
        network: "TRON",
      }).success,
    ).toBe(true);
  });
  it("conserva condiciones sin datos de membresía", () =>
    expect(parseAuctionMethods([{ name: "Banco acordado", kind: "bank" }])).toEqual([
      { name: "Banco acordado", kind: "bank" },
    ]));
});
