import { describe, expect, it } from "vitest";
import { canComplete, chatWritable, mutuallyComplete } from "./operations";
describe("confirmaciones independientes", () => {
  it("cierre mutuo requiere ambas aceptaciones, confirmaciones y ninguna disputa", () => {
    expect(mutuallyComplete("pending", true, true, true, false)).toBe(true);
    expect(mutuallyComplete("pending", true, true, false, false)).toBe(false);
    expect(mutuallyComplete("pending", true, false, true, false)).toBe(false);
    expect(mutuallyComplete("pending", true, true, true, true)).toBe(false);
    expect(mutuallyComplete("pending", false, true, true, false)).toBe(false);
  });
  it("operación completada deja chat de solo lectura", () => {
    expect(chatWritable("completed")).toBe(false);
    expect(chatWritable("cancelled")).toBe(false);
    expect(chatWritable("pending")).toBe(true);
    expect(chatWritable("disputed")).toBe(true);
  });
  it("no finaliza antes de ambas aceptaciones", () =>
    expect(canComplete("pending", false, false, true, false)).toBe(false));
  it("una parte no confirma por la otra", () => {
    expect(canComplete("pending", true, false, true, true)).toBe(false);
    expect(canComplete("pending", true, false, false, true)).toBe(true);
  });
  it("una disputa bloquea completar", () =>
    expect(canComplete("disputed", false, false, true, true)).toBe(false));
  it("aceptar no equivale a completar", () => {
    expect(mutuallyComplete("pending", true, false, false, false)).toBe(false);
    expect(canComplete("pending", false, false, true, true, true)).toBe(false);
  });
});
