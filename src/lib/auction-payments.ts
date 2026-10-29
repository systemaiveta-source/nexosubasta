import { z } from "zod";
export const auctionMethodSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    kind: z.enum(["bank", "platform", "wallet", "crypto", "other"]),
    asset: z.string().max(40).optional(),
    network: z.string().max(80).optional(),
  })
  .superRefine((m, c) => {
    if (m.kind === "crypto" && (!m.asset?.trim() || !m.network?.trim()))
      c.addIssue({ code: "custom", message: "Indica activo y red" });
  });
export type AuctionMethod = z.infer<typeof auctionMethodSchema>;
export const AUCTION_METHODS: AuctionMethod[] = [
  { name: "Transferencia bancaria", kind: "bank" },
  { name: "PayPal", kind: "platform" },
  { name: "Stripe", kind: "platform" },
  { name: "Wise", kind: "platform" },
  { name: "Skrill", kind: "wallet" },
  { name: "Payoneer", kind: "platform" },
  { name: "Revolut", kind: "wallet" },
  { name: "Mercado Pago", kind: "wallet" },
  { name: "Apple Pay", kind: "wallet" },
  { name: "Google Pay", kind: "wallet" },
  { name: "Poket Nicaragua", kind: "wallet" },
  { name: "Paypalex Nicaragua", kind: "wallet" },
];
export function parseAuctionMethods(value: unknown): AuctionMethod[] {
  const parsed = z.array(auctionMethodSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
