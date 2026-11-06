import { describe, expect, it } from "vitest";
import {
  bidDeadline,
  auctionTimingSchema,
  firstBidDeadline,
  PRODUCT_DURATIONS,
} from "./auction-timing";
describe("plazos de productos", () => {
  it("tiempo fijo no se extiende ni en el último instante", () => {
    expect(bidDeadline("fixed", 100000, 40000, false, 5)).toBe(100000);
    expect(bidDeadline("fixed", 100000, 99999, false, 5)).toBe(100000);
  });
  it("reserva alcanzada reinicia cinco minutos desde cada puja", () => {
    expect(bidDeadline("reserve", 900000, 100000, true, 5)).toBe(400000);
    expect(bidDeadline("reserve", 400000, 200000, true, 5)).toBe(500000);
  });
  it("reserva no alcanzada no reinicia", () => {
    expect(bidDeadline("reserve", 900000, 899000, false, 5)).toBe(900000);
  });
  it("período configurable en minutos enteros entre uno y un día", () => {
    expect(
      auctionTimingSchema.safeParse({ closing_mode: "reserve", quiet_period_minutes: 0 }).success,
    ).toBe(false);
    expect(auctionTimingSchema.safeParse({ quiet_period_minutes: 1.5 }).success).toBe(false);
    expect(
      auctionTimingSchema.parse({ closing_mode: "reserve", quiet_period_minutes: 1440 })
        .quiet_period_minutes,
    ).toBe(1440);
  });
  it.each(PRODUCT_DURATIONS)("primera puja conserva íntegramente %i horas", (hours) => {
    expect(firstBidDeadline(123000, hours)).toBe(123000 + hours * 3600000);
  });
  it("rechaza una duración ajena a las seis aprobadas", () => {
    expect(() => firstBidDeadline(0, 25)).toThrow();
  });
  it("inactividad nunca supera el límite de siete días", () => {
    const cap = 7 * 86400000;
    expect(bidDeadline("reserve", cap, cap - 60000, true, 5, cap)).toBe(cap);
  });
});
