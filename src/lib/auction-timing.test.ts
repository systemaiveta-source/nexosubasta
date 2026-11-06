import { describe, expect, it } from "vitest";
import {
  bidDeadline,
  auctionTimingSchema,
  firstBidDeadline,
  PRODUCT_DURATIONS,
  noBidDeadline,
  reserveDeadline,
  flashDeadline,
  QUIET_MINUTES,
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
  it("solo permite las cinco prórrogas aprobadas y exige modalidad explícita", () => {
    expect(
      auctionTimingSchema.safeParse({ closing_mode: "reserve", quiet_period_minutes: 0 }).success,
    ).toBe(false);
    expect(auctionTimingSchema.safeParse({ closing_mode: "reserve", quiet_period_minutes: 1.5 }).success).toBe(false);
    expect(auctionTimingSchema.safeParse({ closing_mode: "reserve", quiet_period_minutes: 1440 }).success).toBe(false);
    expect(auctionTimingSchema.safeParse({ quiet_period_minutes: 5 }).success).toBe(false);
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
  it("fijo sin ofertas tiene ocho días exactos desde publicación", () => {
    expect(noBidDeadline(123000, "fixed")).toBe(123000 + 8 * 86400000);
  });
  it("primera puja justo antes de ocho días conserva los treinta días completos", () => {
    const first = noBidDeadline(0, "fixed") - 1;
    expect(firstBidDeadline(first, 720)).toBe(first + 30 * 86400000);
  });
  it.each(QUIET_MINUTES)("reserva elegible reinicia %i minutos completos sin recorte al límite", (m) => {
    const cap = 7 * 86400000;
    expect(reserveDeadline(cap, cap - 1, true, m)).toBe(cap - 1 + m * 60000);
    expect(reserveDeadline(cap, cap - 1, false, m)).toBe(cap);
  });
  it("reserva sin condición comienza su prórroga con primera puja", () => {
    expect(reserveDeadline(7 * 86400000, 1000, true, 5)).toBe(301000);
  });
  it("flash sin pujas finaliza en siete días desde publicación", () => {
    expect(noBidDeadline(123000, "flash")).toBe(123000 + 7 * 86400000);
  });
  it("flash primera puja inicia siete días completos sin prórroga anticipada", () => {
    const end = flashDeadline(7 * 86400000, 60000, true, 10);
    expect(end).toBe(60000 + 7 * 86400000);
    expect(flashDeadline(end, end - 1, false, 10)).toBe(end);
  });
  it.each(QUIET_MINUTES)("flash reinicia %i minutos solo al terminar fase de pujas", (m) => {
    const cap = 7 * 86400000;
    expect(flashDeadline(cap, cap, false, m)).toBe(cap + m * 60000);
    expect(flashDeadline(cap, cap + 1000, false, m)).toBe(cap + 1000 + m * 60000);
  });
  it("modalidades simultáneas no modifican el reloj de otra", () => {
    const fixed = firstBidDeadline(1000, 24);
    const reserve = reserveDeadline(7 * 86400000, 2000, true, 5);
    const flash = flashDeadline(7 * 86400000, 3000, true, 30);
    expect(fixed).toBe(86401000);
    expect(reserve).toBe(302000);
    expect(flash).toBe(604803000);
    reserveDeadline(7 * 86400000, 4000, true, 30);
    expect(fixed).toBe(86401000);
    expect(flash).toBe(604803000);
  });
});
