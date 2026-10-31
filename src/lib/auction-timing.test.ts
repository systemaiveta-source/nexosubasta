import { describe, expect, it } from "vitest";
import { bidDeadline, auctionTimingSchema } from "./auction-timing";
describe("plazos de productos", () => {
  it("tiempo fijo suma exactamente 60 segundos con 60 restantes", () => {
    expect(bidDeadline("fixed", 100000, 40000, false, 300)).toBe(160000);
    expect(bidDeadline("fixed", 100000, 39999, false, 300)).toBe(100000);
  });
  it("reserva alcanzada inicia y reinicia 300 segundos desde cada puja", () => {
    expect(bidDeadline("reserve", 900000, 100000, true, 300)).toBe(400000);
    expect(bidDeadline("reserve", 400000, 200000, true, 300)).toBe(500000);
  });
  it("reserva no alcanzada no reinicia", () => {
    expect(bidDeadline("reserve", 900000, 899000, false, 300)).toBe(900000);
  });
  it("período configurable entre 60 segundos y un día", () => {
    expect(
      auctionTimingSchema.safeParse({ closing_mode: "reserve", quiet_period_seconds: 59 }).success,
    ).toBe(false);
    expect(
      auctionTimingSchema.parse({ closing_mode: "reserve", quiet_period_seconds: 86400 })
        .quiet_period_seconds,
    ).toBe(86400);
  });
});
