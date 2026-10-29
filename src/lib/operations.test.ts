import { describe, expect, it } from "vitest";
import { canComplete, nextOperationStage } from "./operations";
describe("confirmaciones independientes", () => {
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
