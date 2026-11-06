import { z } from "zod";
export const PRODUCT_DURATIONS = [24, 48, 72, 168, 360, 720] as const;
export const auctionTimingSchema = z.object({
  closing_mode: z.enum(["fixed", "reserve"]).default("fixed"),
  quiet_period_minutes: z.number().int().min(1).max(1440).default(5),
});
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
