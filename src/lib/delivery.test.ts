import { describe, expect, it } from "vitest";
import { deliverySchema } from "./delivery";
describe("entrega declarada", () => {
  it("envío adicional exige costo positivo", () => {
    expect(deliverySchema.safeParse({ mode: "paid", cost: null, conditions: "" }).success).toBe(
      false,
    );
    expect(
      deliverySchema.safeParse({ mode: "paid", cost: 5, conditions: "Solo Managua" }).success,
    ).toBe(true);
  });
  it("Otros exige descripción", () => {
    expect(deliverySchema.safeParse({ mode: "other", cost: null, conditions: "" }).success).toBe(
      false,
    );
  });
  it("retiro no asume envío gratuito ni admite sobrecosto oculto", () => {
    expect(deliverySchema.parse({ mode: "pickup", cost: null, conditions: "Centro" }).mode).toBe(
      "pickup",
    );
    expect(deliverySchema.safeParse({ mode: "free", cost: 5, conditions: "" }).success).toBe(false);
  });
});
