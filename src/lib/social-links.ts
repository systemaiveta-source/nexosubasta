import { z } from "zod";
export const SOCIAL_NETWORKS = ["Facebook", "Instagram", "TikTok", "YouTube", "WhatsApp", "X", "Personalizada"] as const;
export const socialLinkSchema = z.object({
  id: z.string().uuid().optional(),
  network: z.enum(SOCIAL_NETWORKS),
  label: z.string().trim().min(1).max(60),
  url: z.string().trim().max(2048).refine((value) => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && !/^(localhost|127\.|\[|0\.0\.0\.0)/.test(url.hostname); } catch { return false; }
  }, "Usa un enlace HTTPS público sin credenciales"),
  active: z.boolean(),
  sort: z.number().int().min(0).max(10000),
});