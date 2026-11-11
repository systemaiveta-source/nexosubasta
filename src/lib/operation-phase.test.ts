import { describe, expect, it } from "vitest";
import { operationPhase } from "./operations";
const base = { status: "pending", buyer_payment_accepted_at: null, seller_payment_accepted_at: null, buyer_confirmed: false, seller_confirmed: false };
const now = "2026-11-11T00:00:00Z";
describe("operationPhase", () => {
  it("sin aceptaciones", () => expect(operationPhase(base)).toBe("pending_acceptance"));
  it("solo vendedor aceptó", () => expect(operationPhase({ ...base, seller_payment_accepted_at: now })).toBe("awaiting_buyer_acceptance"));
  it("solo comprador aceptó", () => expect(operationPhase({ ...base, buyer_payment_accepted_at: now })).toBe("awaiting_seller_acceptance"));
  const both = { ...base, buyer_payment_accepted_at: now, seller_payment_accepted_at: now };
  it("ambos aceptaron", () => expect(operationPhase(both)).toBe("coordinating"));
  it("una sola confirmación no completa", () => expect(operationPhase({ ...both, buyer_confirmed: true })).toBe("awaiting_one_confirmation"));
  it("completada solo con estado del servidor", () => expect(operationPhase({ ...both, buyer_confirmed: true, seller_confirmed: true })).toBe("coordinating"));
  it("completada", () => expect(operationPhase({ ...both, status: "completed" })).toBe("completed"));
  it("disputa abierta", () => expect(operationPhase(both, true)).toBe("disputed"));
});
