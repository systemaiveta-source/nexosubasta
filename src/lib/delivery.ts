import { z } from "zod";
export const deliveryModes = {
  free: "Envío gratis",
  paid: "Envío con costo adicional",
  pickup: "Retiro en el lugar",
  other: "Otro",
} as const;
export const deliverySchema = z
  .object({
    mode: z.enum(["free", "paid", "pickup", "other"]),
    cost: z.number().finite().min(0).nullable(),
    conditions: z.string().trim().max(2000),
  })
  .superRefine((value, context) => {
    if (value.mode === "paid" && (value.cost === null || value.cost <= 0))
      context.addIssue({ code: "custom", message: "Indica el costo adicional de envío" });
    if (value.mode === "other" && value.conditions.length < 5)
      context.addIssue({ code: "custom", message: "Describe la modalidad y condiciones" });
    if (value.mode !== "paid" && value.cost !== null)
      context.addIssue({
        code: "custom",
        message: "El costo adicional corresponde a envío con costo",
      });
  });
export type Delivery = z.infer<typeof deliverySchema>;
export function parseDelivery(value: unknown): Delivery | null {
  const parsed = deliverySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
