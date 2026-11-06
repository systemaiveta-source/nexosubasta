import { z } from "zod";
export const PRODUCT_DURATIONS = [24, 48, 72, 168, 360, 720] as const;
export const QUIET_MINUTES = [5, 10, 15, 20, 30] as const;
export type ProductMode = "fixed" | "reserve" | "flash";
export function modeLabel(mode: string | null | undefined) {
  return mode === "flash"
    ? "Libre / Flash"
    : mode === "reserve"
      ? "Reserva + prórrogas"
      : "Tiempo fijo";
}
export const auctionTimingSchema = z.object({
  closing_mode: z.enum(["fixed", "reserve", "flash"]),
  quiet_period_minutes: z
    .number()
    .int()
    .refine((n) => QUIET_MINUTES.some((m) => m === n), "Elige 5, 10, 15, 20 o 30 minutos")
    .default(5),
});
export function noBidDeadline(publishedAt: number, mode: ProductMode) {
  return publishedAt + (mode === "fixed" ? 8 : 7) * 86400000;
}
export function bidDeadline(
  mode: "fixed" | "reserve",
  oldEnd: number,
  now: number,
  met: boolean,
  quietMinutes: number,
  cap = Number.POSITIVE_INFINITY,
) {
  if (mode === "reserve" && met) return Math.min(now + quietMinutes * 60000, cap);
  return oldEnd;
}
export function firstBidDeadline(now: number, durationHours: number) {
  if (!PRODUCT_DURATIONS.some((hours) => hours === durationHours))
    throw new Error("Duración no válida");
  return now + durationHours * 3600000;
}
export function reserveDeadline(cap: number, now: number, eligible: boolean, minutes: number) {
  return eligible ? now + minutes * 60000 : cap;
}
export function flashDeadline(cap: number, now: number, first: boolean, minutes: number) {
  if (first) return now + 7 * 86400000;
  return now >= cap ? now + minutes * 60000 : cap;
}
