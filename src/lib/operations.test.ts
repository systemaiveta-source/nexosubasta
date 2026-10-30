import { describe, expect, it } from "vitest";
import { canComplete, chatWritable, mutuallyComplete, nextOperationStage } from "./operations";
describe("confirmaciones independientes", () => {
  it("cierre mutuo requiere pago/entrega y ninguna disputa", () => {
    expect(mutuallyComplete("pending", "completion_pending", true, true, false)).toBe(true);
    expect(mutuallyComplete("pending", "completion_pending", true, false, false)).toBe(false);
    expect(mutuallyComplete("pending", "completion_pending", true, true, true)).toBe(false);
    expect(mutuallyComplete("pending", "coordination", true, true, false)).toBe(false);
  });
  it("operación completada deja chat de solo lectura", () => {
    expect(chatWritable("completed")).toBe(false);
    expect(chatWritable("cancelled")).toBe(false);
    expect(chatWritable("pending")).toBe(true);
    expect(chatWritable("disputed")).toBe(true);
  });
  it("no finaliza antes de pago y entrega", () =>
    expect(canComplete("pending", false, false, true, "coordination")).toBe(false));
  it("una parte no confirma por la otra", () => {
    expect(canComplete("pending", true, false, true)).toBe(false);
    expect(canComplete("pending", true, false, false)).toBe(true);
  });
  it("una disputa bloquea completar", () =>
    expect(canComplete("disputed", false, false, true)).toBe(false));
  it("solo receptor confirma recepción de pago", () => {
    expect(nextOperationStage("receipt_sent", true)).toBeNull();
    expect(nextOperationStage("receipt_sent", false)).toBe("payment_confirmed");
  });
});
