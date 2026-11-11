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
  it("incluye efectivo y varias pasarelas de pago comunes", () => {
    const methods = parseAuctionMethods([
      { name: "Efectivo", kind: "other" },
      { name: "Zelle", kind: "wallet" },
      { name: "Cash App", kind: "wallet" },
      { name: "Binance Pay", kind: "platform" },
    ]);
    expect(methods.map((method) => method.name)).toEqual([
      "Efectivo", "Zelle", "Cash App", "Binance Pay",
    ]);
  });
  it("conserva condiciones sin datos de membresía", () =>
    expect(parseAuctionMethods([{ name: "Banco acordado", kind: "bank" }])).toEqual([
      { name: "Banco acordado", kind: "bank" },
    ]));
});
