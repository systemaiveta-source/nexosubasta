import { z } from "zod";
export const auctionTimingSchema = z.object({
  closing_mode: z.enum(["fixed", "reserve"]).default("fixed"),
  quiet_period_seconds: z.number().int().min(60).max(86400).default(300),
});
export function bidDeadline(mode: "fixed" | "reserve", oldEnd: number, now: number, met: boolean, quietSeconds: number) {
  if (mode === "reserve" && met) return now + quietSeconds * 1000;
  return mode === "fixed" && oldEnd - now <= 60000 ? oldEnd + 60000 : oldEnd;
}